"""Seeder tests against a real (throwaway) MySQL database."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event, select

from app.demo import DEMO_USER_EMAIL
from app.demo.seed import (
    DemoSeedError,
    EXIT_LOCKED,
    EXIT_REAL_ACCOUNT,
    EXIT_WRONG_DB,
    LOCK_NAME,
    load_fixture,
    reset_demo_account,
    resolve,
)

NOW = datetime(2026, 10, 21, 10, 30)

SNAPSHOT_TABLES = [
    "users",
    "tasks",
    "daily_briefs",
    "notifications",
    "notification_subscriptions",
    "refresh_tokens",
    "password_resets",
]


def dataset_for(now=NOW):
    return resolve(load_fixture(), now, now.date())


def seed(db_name, now=NOW, dataset=None):
    return reset_demo_account(dataset or dataset_for(now), now, db_name, out=lambda *_: None)


def query(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close()
    return rows


def execute(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    conn.commit()
    last = cur.lastrowid
    cur.close()
    return last


def make_user(conn, email, first="Real"):
    return execute(
        conn,
        "INSERT INTO users (first_name, last_name, email, password_hash, is_demo) VALUES (%s, 'User', %s, 'x', 0)",
        (first, email),
    )


def add_real_data(conn, user_id, titles):
    execute(
        conn,
        "INSERT INTO tasks (title, category, start_at, end_at, user_id, series_id) VALUES (%s,'work',%s,%s,%s,NULL)",
        (titles[0], "2026-10-01 09:00:00", "2026-10-01 10:00:00", user_id),
    )
    for title in titles[1:]:
        execute(
            conn,
            "INSERT INTO tasks (title, category, start_at, end_at, user_id, is_completed, completed_at) "
            "VALUES (%s,'home',%s,%s,%s,1,%s)",
            (title, "2026-10-02 09:00:00", "2026-10-02 10:00:00", user_id, "2026-10-02 10:05:00"),
        )
    execute(
        conn,
        "INSERT INTO daily_briefs (user_id, brief_text, generated_date) VALUES (%s,'mine','2026-10-21')",
        (user_id,),
    )
    execute(
        conn,
        "INSERT INTO notifications (user_id, title, message) VALUES (%s,'hi','there')",
        (user_id,),
    )
    execute(
        conn,
        "INSERT INTO notification_subscriptions (user_id, endpoint, p256dh, auth) VALUES (%s,%s,'k','a')",
        (user_id, f"https://push.example/{user_id}"),
    )
    for token, expires in (("live-%d" % user_id, "2099-01-01 00:00:00"), ("old-%d" % user_id, "2000-01-01 00:00:00")):
        execute(
            conn,
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (%s,%s,%s)",
            (user_id, token, expires),
        )
    execute(
        conn,
        "INSERT INTO password_resets (user_id, token, expires_at) VALUES (%s,'tok','2099-01-01 00:00:00')",
        (user_id,),
    )


def snapshot(conn, user_ids):
    ids = ",".join(str(i) for i in user_ids)
    out = {}
    for table in SNAPSHOT_TABLES:
        col = "id" if table == "users" else "user_id"
        out[table] = query(conn, f"SELECT * FROM {table} WHERE {col} IN ({ids}) ORDER BY 1, 2")
    return out


def demo_user_id(conn):
    return query(conn, "SELECT id FROM users WHERE email=%s AND is_demo=1", (DEMO_USER_EMAIL,))[0][0]


def comparable_tasks(conn, user_id):
    rows = query(
        conn,
        "SELECT t.title, t.description, t.category, t.is_completed, t.start_at, t.end_at, t.created_at, "
        "t.completed_at, t.is_repeating, t.repeat_by, t.repeat_until, "
        "CASE WHEN t.series_id = t.id THEN 'self' ELSE m.title END "
        "FROM tasks t LEFT JOIN tasks m ON m.id = t.series_id WHERE t.user_id=%s",
        (user_id,),
    )
    return sorted(rows, key=repr)


def test_seeds_an_empty_database(raw_db, clean_db):
    counts = seed(clean_db)
    dataset = dataset_for()

    user = query(raw_db, "SELECT id, first_name, is_demo, password_hash FROM users")
    assert len(user) == 1 and user[0][2] == 1
    assert user[0][3] and not user[0][3].startswith("x")  # an unusable hash, never empty
    demo_id = user[0][0]

    assert query(raw_db, "SELECT COUNT(*) FROM tasks WHERE user_id=%s", (demo_id,))[0][0] == len(dataset.rows)
    assert counts["tasks inserted"] == len(dataset.rows)
    brief = query(raw_db, "SELECT generated_date, brief_text FROM daily_briefs WHERE user_id=%s", (demo_id,))
    assert [str(brief[0][0])] == ["2026-10-21"] and "Vibe check" in brief[0][1]


def test_series_links_and_completion_timestamps(raw_db, clean_db):
    seed(clean_db)
    demo_id = demo_user_id(raw_db)

    assert query(raw_db, "SELECT COUNT(*) FROM tasks WHERE is_completed=1 AND completed_at IS NULL")[0][0] == 0
    # Standalone rows and masters point at themselves; history rows at a repeating master.
    orphans = query(
        raw_db,
        "SELECT COUNT(*) FROM tasks h WHERE h.user_id=%s AND (h.series_id IS NULL OR "
        "(h.series_id <> h.id AND NOT EXISTS (SELECT 1 FROM tasks m WHERE m.id = h.series_id "
        "AND m.is_repeating = 1 AND m.user_id = h.user_id)))",
        (demo_id,),
    )
    assert orphans[0][0] == 0
    dataset = dataset_for()
    # The trigger-safe UPDATE for series_id left every completed_at as the fixture says.
    expected = sorted(r.completed_at for r in dataset.rows if r.completed_at)
    stored = sorted(r[0] for r in query(raw_db, "SELECT completed_at FROM tasks WHERE completed_at IS NOT NULL"))
    assert stored == expected


def test_is_idempotent(raw_db, clean_db):
    seed(clean_db)
    first_id = demo_user_id(raw_db)
    first = comparable_tasks(raw_db, first_id)

    seed(clean_db)
    seed(clean_db)

    assert demo_user_id(raw_db) == first_id
    assert query(raw_db, "SELECT COUNT(*) FROM users")[0][0] == 1
    assert comparable_tasks(raw_db, first_id) == first
    assert query(raw_db, "SELECT COUNT(*) FROM daily_briefs")[0][0] == 1


def test_never_touches_other_users(raw_db, clean_db):
    alice = make_user(raw_db, "alice@example.com")
    bob = make_user(raw_db, "bob@example.com")
    dataset = dataset_for()
    # Real users with tasks that share titles with the demo data.
    add_real_data(raw_db, alice, [dataset.rows[0].title, "Alice only", dataset.rows[1].title])
    add_real_data(raw_db, bob, ["Bob only"])
    before = snapshot(raw_db, [alice, bob])

    from app.database import engine

    statements = []

    @event.listens_for(engine, "before_cursor_execute")
    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    try:
        seed(clean_db)
        seed(clean_db)  # second run exercises the delete path against existing demo data
    finally:
        event.remove(engine, "before_cursor_execute", capture)

    assert snapshot(raw_db, [alice, bob]) == before

    writes = [s for s in statements if s.lstrip().upper().startswith(("DELETE", "UPDATE", "TRUNCATE"))]
    assert writes
    for sql in writes:
        head = sql.lstrip().upper()
        assert not head.startswith("TRUNCATE")
        if head.startswith("DELETE"):
            assert "user_id" in sql, sql
        else:
            # Only the demo user's own row and its tasks' series_id are ever updated.
            assert head.startswith(("UPDATE USERS", "UPDATE TASKS")) and "WHERE" in head, sql


def test_refuses_to_adopt_a_real_account_with_the_demo_email(raw_db, clean_db):
    real = make_user(raw_db, DEMO_USER_EMAIL, first="Mallory")
    add_real_data(raw_db, real, ["Precious"])
    before = snapshot(raw_db, [real])

    with pytest.raises(DemoSeedError) as exc:
        seed(clean_db)

    assert exc.value.code == EXIT_REAL_ACCOUNT
    assert snapshot(raw_db, [real]) == before
    assert query(raw_db, "SELECT is_demo FROM users WHERE id=%s", (real,))[0][0] == 0


def test_wrong_confirm_db_writes_nothing(raw_db, clean_db):
    with pytest.raises(DemoSeedError) as exc:
        seed("some_other_database")
    assert exc.value.code == EXIT_WRONG_DB
    assert query(raw_db, "SELECT COUNT(*) FROM users")[0][0] == 0


def test_failure_rolls_back_to_the_previous_demo_data(raw_db, clean_db):
    seed(clean_db)
    demo_id = demo_user_id(raw_db)
    before = query(raw_db, "SELECT * FROM tasks WHERE user_id=%s ORDER BY id", (demo_id,))
    brief_before = query(raw_db, "SELECT * FROM daily_briefs WHERE user_id=%s", (demo_id,))

    broken = dataset_for()
    broken.rows[-1].title = None  # NOT NULL violation, raised after the deletes ran

    with pytest.raises(Exception):
        seed(clean_db, dataset=broken)

    assert query(raw_db, "SELECT * FROM tasks WHERE user_id=%s ORDER BY id", (demo_id,)) == before
    assert query(raw_db, "SELECT * FROM daily_briefs WHERE user_id=%s", (demo_id,)) == brief_before


def test_second_concurrent_run_is_refused(raw_db, clean_db):
    holder = raw_db.cursor()
    holder.execute("SELECT GET_LOCK(%s, 0)", (LOCK_NAME,))
    assert holder.fetchone()[0] == 1
    try:
        with pytest.raises(DemoSeedError) as exc:
            seed(clean_db)
        assert exc.value.code == EXIT_LOCKED
        assert query(raw_db, "SELECT COUNT(*) FROM tasks")[0][0] == 0
    finally:
        holder.execute("SELECT RELEASE_LOCK(%s)", (LOCK_NAME,))
        holder.fetchall()
        holder.close()
    seed(clean_db)  # lock released, so it now works
    raw_db.commit()  # start a new snapshot to see the committed rows
    assert query(raw_db, "SELECT COUNT(*) FROM tasks")[0][0] > 0


def test_live_sessions_survive_but_expired_ones_are_removed(raw_db, clean_db):
    seed(clean_db)
    demo_id = demo_user_id(raw_db)
    execute(raw_db, "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (%s,'live','2099-01-01 00:00:00')", (demo_id,))
    execute(raw_db, "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (%s,'dead','2000-01-01 00:00:00')", (demo_id,))
    execute(raw_db, "INSERT INTO notifications (user_id, title, message) VALUES (%s,'t','m')", (demo_id,))
    execute(raw_db, "INSERT INTO notification_subscriptions (user_id, endpoint, p256dh, auth) VALUES (%s,'https://x','k','a')", (demo_id,))

    seed(clean_db)

    tokens = {r[0] for r in query(raw_db, "SELECT token FROM refresh_tokens WHERE user_id=%s", (demo_id,))}
    assert tokens == {"live"}
    assert query(raw_db, "SELECT COUNT(*) FROM notifications")[0][0] == 0
    assert query(raw_db, "SELECT COUNT(*) FROM notification_subscriptions")[0][0] == 0


# --- behaviour under the existing recurrence + stats code ------------------- #


@pytest.fixture
def app_ctx(flask_app):
    with flask_app.app_context():
        yield


def test_projected_occurrences_do_not_duplicate_seeded_rows(app_ctx, raw_db, clean_db):
    from app.models import Task
    from app.utils.task_utils import with_repeating
    from app.database import db

    seed(clean_db)
    demo_id = demo_user_id(raw_db)
    masters = db.session.execute(
        select(Task).where(Task.user_id == demo_id, Task.is_repeating.is_(True))
    ).scalars().all()
    assert len(masters) == 8

    view_start = NOW - timedelta(days=35)
    view_end = NOW + timedelta(days=35)
    ghosts = with_repeating([], view_start, view_end, demo_id)
    stored_starts = {
        (t.series_id, t.start_at) for t in db.session.execute(select(Task).where(Task.user_id == demo_id)).scalars()
    }

    by_master = {}
    for g in ghosts:
        assert g["is_ghost"]
        by_master.setdefault(g["series_id"], []).append(g["start_at"].replace(tzinfo=None))

    for m in masters:
        starts = by_master.get(m.id, [])
        # Ghosts only run forward from the master's own occurrence and never repeat it.
        assert all(s > m.start_at for s in starts), m.title
        assert len(starts) == len(set(starts))
        if m.repeat_until:
            assert all(s.date() <= m.repeat_until for s in starts)
        # Nothing is projected on top of a stored history occurrence.
        assert not (set((m.id, s) for s in starts) & stored_starts), m.title

    ended = next(m for m in masters if m.title.startswith("SQL performance"))
    assert ended.is_completed and ended.id not in by_master
    assert all(m.id in by_master for m in masters if m.title in {"Team sync", "Morning run", "Guitar lesson"})


def test_completing_a_seeded_master_behaves_like_a_real_one(app_ctx, raw_db, clean_db):
    from app.services.task_service import update_task

    seed(clean_db)
    demo_id = demo_user_id(raw_db)
    master_id, start_before = query(
        raw_db, "SELECT id, start_at FROM tasks WHERE user_id=%s AND title='Team sync' AND is_repeating=1", (demo_id,)
    )[0]
    rows_before = query(raw_db, "SELECT COUNT(*) FROM tasks WHERE user_id=%s", (demo_id,))[0][0]

    now = datetime.now(timezone.utc)
    update_task(str(demo_id), master_id, {"isCompleted": True, "completedAt": now.isoformat()})
    raw_db.commit()

    assert query(raw_db, "SELECT COUNT(*) FROM tasks WHERE user_id=%s", (demo_id,))[0][0] == rows_before + 1
    start_after, completed = query(raw_db, "SELECT start_at, is_completed FROM tasks WHERE id=%s", (master_id,))[0]
    assert start_after == start_before + timedelta(weeks=1) and completed == 0
    history = query(
        raw_db,
        "SELECT is_repeating, is_completed FROM tasks WHERE user_id=%s AND series_id=%s AND id<>%s AND start_at=%s",
        (demo_id, master_id, master_id, start_before),
    )
    assert history == [(0, 1)]


def test_dashboard_stats_are_fully_populated(app_ctx, raw_db, clean_db):
    from app.services.stats_service import get_all_dashboard_stats

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    seed(clean_db, now=now)
    demo_id = demo_user_id(raw_db)

    stats = get_all_dashboard_stats(demo_id)

    assert sum(d["tasks"] for d in stats["productivity"]) > 30
    assert len([d for d in stats["productivity"] if d["tasks"]]) >= 20  # activity heat-map
    assert len(stats["timeSpent"]) == 11
    backlog = {d["status"]: d["count"] for d in stats["backlogHealth"]}
    assert all(backlog[k] > 0 for k in ("Completed", "Overdue", "Pending"))
    assert len(stats["categoryVolume"]) == 11
    assert len(stats["overdueDistribution"]) >= 3
    assert len(stats["deadlineProximity"]) >= 8
    assert sum(1 for h in stats["hourlyProductivity"] if h["count"]) >= 8
    assert len(stats["turnaround"]) > 3
    assert len(stats["estimationAccuracy"]) > 10
    assert len(stats["weekOverview"]) >= 5
    assert sum(1 for d in stats["distributionTrend"] if any(v for k, v in d.items() if k != "date")) >= 4


def test_seeded_data_is_searchable(raw_db, clean_db):
    seed(clean_db)
    hits = query(
        raw_db,
        "SELECT COUNT(*) FROM tasks WHERE MATCH(title, description) AGAINST('aws*' IN BOOLEAN MODE)",
    )
    assert hits[0][0] >= 5
