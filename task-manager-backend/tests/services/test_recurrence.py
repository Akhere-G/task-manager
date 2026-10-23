from datetime import datetime

import pytest

from app.database import db
from app.models import Task
from app.services import task_service
from app.services.task_query import TaskQuery
from app.utils import task_utils


@pytest.fixture
def ctx(app):
    with app.app_context():
        yield


@pytest.fixture
def user_id(ctx, make_user):
    return make_user()


def add_series(user_id, task_payload, repeat_by, start, end=None, **overrides):
    fields = {
        "title": "Standup",
        "startAt": start,
        "endAt": end or start.replace("09:00", "10:00"),
        "isRepeating": True,
        "repeatBy": repeat_by,
    }
    fields.update(overrides)
    return task_service.create_task(user_id, task_payload(**fields))


def project(user_id, start_date, end_date, **query):
    return task_service.get_all_tasks(
        user_id,
        TaskQuery(start_date=start_date, end_date=end_date, project_repeating=True, **query),
    )


def ghosts(result):
    return [t for t in result["tasks"] if t.get("is_ghost")]


def ghost_starts(result):
    return [g["start_at"].replace(tzinfo=None) for g in ghosts(result)]


def row_count():
    return db.session.query(Task).count()


@pytest.mark.parametrize(
    "repeat_by, head, window, expected",
    [
        (
            "daily",
            "2026-03-02 09:00:00",
            ("2026-03-03", "2026-03-09"),
            [datetime(2026, 3, d, 9) for d in range(3, 9)],
        ),
        (
            "weekly",
            "2026-03-02 09:00:00",
            ("2026-03-09", "2026-04-01"),
            [datetime(2026, 3, 9, 9), datetime(2026, 3, 16, 9),
             datetime(2026, 3, 23, 9), datetime(2026, 3, 30, 9)],
        ),
        (
            "monthly",
            "2026-01-15 09:00:00",
            ("2026-03-01", "2026-06-01"),
            [datetime(2026, 3, 15, 9), datetime(2026, 4, 15, 9), datetime(2026, 5, 15, 9)],
        ),
        (
            "yearly",
            "2024-03-02 09:00:00",
            ("2026-01-01", "2027-12-31"),
            [datetime(2026, 3, 2, 9), datetime(2027, 3, 2, 9)],
        ),
    ],
)
def test_each_frequency_projects_the_expected_occurrences(
    user_id, task_payload, repeat_by, head, window, expected
):
    add_series(user_id, task_payload, repeat_by, head)

    starts = ghost_starts(project(user_id, *window))

    # The final day of the window is deliberately not asserted on; see the xfail below.
    assert [s for s in starts if s in expected] == expected
    assert all(s >= datetime.fromisoformat(window[0]) for s in starts)


def test_ghosts_keep_the_series_duration_and_identity(user_id, task_payload):
    head_id = add_series(
        user_id, task_payload, "daily", "2026-03-02 09:00:00", "2026-03-02 09:45:00"
    )

    found = ghosts(project(user_id, "2026-03-03", "2026-03-06"))

    assert found
    for ghost in found:
        assert ghost["series_id"] == head_id
        assert ghost["title"] == "Standup"
        assert ghost["end_at"] - ghost["start_at"] == datetime(2026, 3, 2, 9, 45) - datetime(2026, 3, 2, 9)
        assert ghost["id"] == f"ghost_{head_id}_{ghost['start_at']:%Y%m%d}"
    assert len({g["id"] for g in found}) == len(found)


def test_the_series_head_is_listed_once_and_never_also_as_a_ghost(user_id, task_payload):
    head_id = add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00")

    result = project(user_id, "2026-03-01", "2026-03-05")

    real = [t for t in result["tasks"] if not t.get("is_ghost")]
    assert [t["id"] for t in real] == [head_id]
    assert datetime(2026, 3, 2, 9) not in ghost_starts(result)


def test_repeat_until_is_inclusive_and_stops_the_series(user_id, task_payload):
    add_series(
        user_id, task_payload, "daily", "2026-03-02 09:00:00", repeatUntil="2026-03-05"
    )

    starts = ghost_starts(project(user_id, "2026-03-01", "2026-03-31"))

    assert starts == [datetime(2026, 3, d, 9) for d in (3, 4, 5)]


def test_no_occurrences_after_the_series_has_ended(user_id, task_payload):
    add_series(
        user_id, task_payload, "daily", "2026-03-02 09:00:00", repeatUntil="2026-03-05"
    )

    assert ghosts(project(user_id, "2026-04-01", "2026-04-10")) == []


def test_no_occurrences_before_the_series_starts(user_id, task_payload):
    add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00")

    assert ghosts(project(user_id, "2026-02-01", "2026-02-10")) == []


def test_a_window_far_after_the_head_still_lands_on_the_series_cadence(user_id, task_payload):
    add_series(user_id, task_payload, "weekly", "2026-03-02 09:00:00")

    starts = ghost_starts(project(user_id, "2026-06-01", "2026-06-20"))

    assert datetime(2026, 6, 8, 9) in starts and datetime(2026, 6, 15, 9) in starts
    assert all(s.weekday() == 0 for s in starts)


def test_refetching_the_calendar_regenerates_the_same_ghosts_without_saving_them(
    user_id, task_payload
):
    add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00")
    before = row_count()

    first = project(user_id, "2026-03-01", "2026-03-10")
    second = project(user_id, "2026-03-01", "2026-03-10")
    third = project(user_id, "2026-03-05", "2026-03-12")

    assert row_count() == before == 1
    assert [g["id"] for g in ghosts(first)] == [g["id"] for g in ghosts(second)]
    overlap = {g["id"] for g in ghosts(first)} & {g["id"] for g in ghosts(third)}
    assert overlap, "overlapping windows should describe the same occurrences"


def test_series_do_not_mix_and_other_users_are_excluded(user_id, make_user, task_payload):
    add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00", title="Mine daily")
    add_series(user_id, task_payload, "weekly", "2026-03-02 09:00:00", title="Mine weekly")
    other = make_user("other@example.com")
    add_series(other, task_payload, "daily", "2026-03-02 09:00:00", title="Theirs")

    found = ghosts(project(user_id, "2026-03-03", "2026-03-20"))

    assert {g["title"] for g in found} == {"Mine daily", "Mine weekly"}
    weekly = [g["start_at"].replace(tzinfo=None) for g in found if g["title"] == "Mine weekly"]
    assert weekly == [datetime(2026, 3, 9, 9), datetime(2026, 3, 16, 9)]


def test_category_filter_applies_to_ghosts(user_id, task_payload):
    add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00", category="work")
    add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00", title="Run", category="health")

    found = ghosts(project(user_id, "2026-03-03", "2026-03-06", category="health"))

    assert {g["title"] for g in found} == {"Run"}


def test_projection_is_capped(user_id, task_payload, monkeypatch):
    monkeypatch.setattr(task_utils, "MAX_GHOSTS", 3)
    add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00")

    assert len(ghosts(project(user_id, "2026-03-03", "2026-03-30"))) == 3


def test_completing_an_occurrence_records_it_and_the_projection_continues_after_it(
    user_id, task_payload
):
    head_id = add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00")

    task_service.update_task(
        user_id, head_id, {"isCompleted": True, "expectedStartAt": "2026-03-02 09:00:00"}
    )
    result = project(user_id, "2026-03-01", "2026-03-07")

    series = [t for t in result["tasks"] if t["series_id"] == head_id]
    starts = sorted(t["start_at"].replace(tzinfo=None) for t in series)
    assert starts == [datetime(2026, 3, d, 9) for d in (2, 3, 4, 5, 6)]
    assert len(set(starts)) == len(starts), "no occurrence may be listed twice"

    done = [t for t in series if t["is_completed"]]
    assert [t["start_at"] for t in done] == [datetime(2026, 3, 2, 9)]
    assert done[0]["is_repeating"] is False, "history rows must not spawn ghosts"
    assert row_count() == 2


def test_each_completion_adds_one_history_row_and_advances_by_the_frequency(
    user_id, task_payload
):
    head_id = add_series(user_id, task_payload, "weekly", "2026-03-02 09:00:00")

    for expected in ("2026-03-02 09:00:00", "2026-03-09 09:00:00"):
        task_service.update_task(
            user_id, head_id, {"isCompleted": True, "expectedStartAt": expected}
        )

    head = db.session.get(Task, head_id)
    assert head.start_at == datetime(2026, 3, 16, 9)
    assert head.is_completed is False and head.completed_at is None
    history = db.session.query(Task).filter(Task.id != head_id).order_by(Task.start_at).all()
    assert [h.start_at for h in history] == [datetime(2026, 3, 2, 9), datetime(2026, 3, 9, 9)]
    assert all(h.is_completed and h.series_id == head_id for h in history)


def test_completing_the_final_occurrence_ends_the_series(user_id, task_payload):
    head_id = add_series(
        user_id, task_payload, "daily", "2026-03-02 09:00:00", repeatUntil="2026-03-02"
    )

    task_service.update_task(user_id, head_id, {"isCompleted": True})

    head = db.session.get(Task, head_id)
    assert head.is_completed is True
    assert row_count() == 1


def test_completing_a_plain_task_never_creates_another(user_id, task_payload):
    task_id = task_service.create_task(user_id, task_payload())

    task_service.update_task(user_id, task_id, {"isCompleted": True})

    assert row_count() == 1
    assert db.session.get(Task, task_id).is_completed is True


def test_rescheduling_the_head_moves_every_later_occurrence(user_id, task_payload):
    head_id = add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00")

    task_service.update_task(
        user_id,
        head_id,
        {"startAt": "2026-03-02 14:00:00", "endAt": "2026-03-02 15:00:00"},
    )
    starts = ghost_starts(project(user_id, "2026-03-03", "2026-03-06"))

    assert starts and all(s.hour == 14 for s in starts)


@pytest.mark.xfail(
    strict=True,
    reason="with_repeating treats a date-only end_date as midnight, so occurrences on "
    "the last day are dropped (task_utils.py:92,128)",
)
def test_occurrences_on_the_last_day_of_the_window_are_included(user_id, task_payload):
    add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00")

    starts = ghost_starts(project(user_id, "2026-03-05", "2026-03-05"))

    assert starts == [datetime(2026, 3, 5, 9)]


@pytest.mark.xfail(
    strict=True,
    reason="monthly dates are advanced from the previous result, so Jan 31 drifts to "
    "Mar 28 instead of Mar 31 (task_utils.py:117-119)",
)
def test_monthly_ghosts_return_to_the_month_end_after_a_short_month(user_id, task_payload):
    add_series(user_id, task_payload, "monthly", "2026-01-31 09:00:00")

    starts = ghost_starts(project(user_id, "2026-03-01", "2026-04-01"))

    assert datetime(2026, 3, 31, 9) in starts


@pytest.mark.xfail(
    strict=True,
    reason="the drifted date is persisted when the head advances (task_utils.py:200-201)",
)
def test_completing_a_month_end_series_twice_lands_on_the_31st(user_id, task_payload):
    head_id = add_series(user_id, task_payload, "monthly", "2026-01-31 09:00:00")

    task_service.update_task(user_id, head_id, {"isCompleted": True})
    task_service.update_task(user_id, head_id, {"isCompleted": True})

    assert db.session.get(Task, head_id).start_at == datetime(2026, 3, 31, 9)


@pytest.mark.xfail(
    strict=True,
    reason="ghosts are appended to every page, so they repeat across pages "
    "(task_service.py:59-72)",
)
def test_ghosts_appear_on_only_one_page(user_id, task_payload):
    add_series(user_id, task_payload, "daily", "2026-03-02 09:00:00")
    for n in range(3):
        task_service.create_task(
            user_id, task_payload(title=f"Plain {n}", startAt="2026-03-04 12:00:00",
                                  endAt="2026-03-04 13:00:00")
        )

    page_one = project(user_id, "2026-03-03", "2026-03-06", limit=2, page=1)
    page_two = project(user_id, "2026-03-03", "2026-03-06", limit=2, page=2)

    assert not {g["id"] for g in ghosts(page_one)} & {g["id"] for g in ghosts(page_two)}
