"""Pure-Python tests for the fixture loader/resolver (no database)."""

import copy
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.demo.seed import (
    Clock,
    DemoSeedError,
    load_fixture,
    resolve,
    step_back,
)

LONDON = ZoneInfo("Europe/London")
NOW = datetime(2026, 10, 21, 10, 30)  # a Wednesday, naive UTC (BST, UTC+1)


def clock(now=NOW):
    return Clock(tz=LONDON, now=now)


def minimal(**task):
    base = {
        "title": "T",
        "category": "work",
        "start": "D+1 09:00",
        "mins": 30,
        "created": "D-1 09:00",
    }
    base.update(task)
    return {
        "fixture_version": 1,
        "timezone": "Europe/London",
        "seed": 1,
        "user": {
            "first_name": "A",
            "last_name": "B",
            "email": "demo@taskflow.invalid",
        },
        "tasks": [base],
        "daily_brief": {"markdown": "hello"},
    }


# --- time specs ------------------------------------------------------------ #


def test_day_offset_converts_local_wall_clock_to_utc():
    # 22 Oct 09:00 BST is 08:00 UTC
    assert clock().resolve_datetime("D+1 09:00") == datetime(2026, 10, 22, 8, 0)
    assert clock().resolve_datetime("D-3 09:00") == datetime(2026, 10, 18, 8, 0)


def test_week_offset_uses_iso_week():
    # Week of Mon 19 Oct: last week's Wednesday is 14 Oct, this Monday is 19 Oct.
    assert clock().resolve_datetime("W-1 wed 19:00") == datetime(2026, 10, 14, 18, 0)
    assert clock().resolve_datetime("W+0 mon 10:00") == datetime(2026, 10, 19, 9, 0)


def test_next_weekday_is_strictly_after_now():
    # Wednesday 10:30 UTC == 11:30 BST. 11:00 today has passed, so next Wednesday
    # (28 Oct, after the clocks go back on the 25th, so local time == UTC).
    assert clock().resolve_datetime("next wed 11:00") == datetime(2026, 10, 28, 11, 0)
    assert clock().resolve_datetime("next wed 12:00") == datetime(2026, 10, 21, 11, 0)
    # Exactly now is not "after" now.
    assert clock().resolve_datetime("next wed 11:30") == datetime(2026, 10, 28, 11, 30)


def test_next_time_of_day_and_day_of_month():
    assert clock().resolve_datetime("next 07:00") == datetime(2026, 10, 22, 6, 0)
    assert clock().resolve_datetime("next 12:00") == datetime(2026, 10, 21, 11, 0)
    assert clock().resolve_datetime("next dom 1 09:00") == datetime(2026, 11, 1, 9, 0)
    # 21st has passed this month; next one is next month.
    assert clock().resolve_datetime("next dom 5 09:00") == datetime(2026, 11, 5, 9, 0)


def test_dst_changes_utc_offset_but_not_wall_clock():
    spring = clock(datetime(2026, 3, 28, 12, 0))
    assert spring.resolve_datetime("D+0 09:00") == datetime(2026, 3, 28, 9, 0)  # GMT
    assert spring.resolve_datetime("D+1 09:00") == datetime(2026, 3, 29, 8, 0)  # BST


def test_nonexistent_local_time_is_rejected():
    spring = clock(datetime(2026, 3, 28, 12, 0))
    with pytest.raises(DemoSeedError):
        spring.resolve_datetime("D+1 01:30")  # clocks jump 01:00 -> 02:00


@pytest.mark.parametrize("spec", ["tomorrow", "D+1", "D+1 9:00", "W-1 xyz 09:00", "next dom 31 09:00", "D+1 25:00"])
def test_bad_specs_are_rejected(spec):
    with pytest.raises(DemoSeedError):
        clock().resolve_datetime(spec)


def test_date_specs():
    assert clock().resolve_date("D+10") == date(2026, 10, 31)
    assert clock().resolve_date("W-1 wed") == date(2026, 10, 14)


def test_step_back_matches_update_date_arithmetic():
    from app.utils.task_utils import update_date

    start = datetime(2026, 5, 15, 9, 0)
    for by in ("daily", "weekly", "monthly", "yearly"):
        assert update_date(step_back(start, by, 3), by) == step_back(start, by, 2)


# --- validation ------------------------------------------------------------ #


def test_minimal_fixture_resolves():
    dataset = resolve(minimal(), NOW)
    assert len(dataset.rows) == 1
    row = dataset.rows[0]
    assert row.end_at - row.start_at == timedelta(minutes=30)
    assert row.completed_at is None and not row.is_master


@pytest.mark.parametrize(
    "mutate",
    [
        lambda f: f["tasks"][0].update(category="nope"),
        lambda f: f["tasks"][0].update(mins=0),
        lambda f: f["tasks"][0].update(title=""),
        lambda f: f["tasks"][0].update(done="D+1 10:00"),  # completed in the future
        lambda f: f["tasks"][0].update(done="D-2 10:00"),  # before created
        lambda f: f["tasks"][0].update(bogus=1),
        lambda f: f["tasks"][0].update(created=None),
        lambda f: f["tasks"][0].update(history={"n": [1], "series_created": "D-9 09:00"}),
        lambda f: f["user"].update(email="someone@example.com"),
        lambda f: f.update(timezone="Mars/Olympus"),
        lambda f: f.update(fixture_version=2),
        lambda f: f["daily_brief"].update(markdown=""),
        lambda f: f.update(extra=True),
    ],
)
def test_invalid_fixtures_are_rejected(mutate):
    fixture = minimal()
    mutate(fixture)
    with pytest.raises(DemoSeedError):
        resolve(fixture, NOW)


def recurring(**overrides):
    task = {
        "start": "next mon 10:00",
        "repeat": {"by": "weekly", "until": None},
        "history": {"n": [1, 2], "done_after_min": 30, "jitter_min": 0, "series_created": "D-40 09:00"},
    }
    task.pop("created", None)
    task.update(overrides)
    fixture = minimal()
    fixture["tasks"][0].pop("created")
    fixture["tasks"][0].update(task)
    return fixture


def test_recurring_series_shape_matches_handle_repeat_task():
    dataset = resolve(recurring(), NOW)
    master, newest, older = dataset.rows
    assert master.is_master and master.repeat_by == "weekly" and master.completed_at is None
    assert newest.is_history and older.is_history
    assert newest.master == 0 and older.master == 0
    assert newest.repeat_by is None and newest.completed_at is not None
    # History steps back whole periods from the master.
    assert master.start_at - newest.start_at == timedelta(weeks=1)
    assert master.start_at - older.start_at == timedelta(weeks=2)
    # created_at chain: the app sets created_at on completion of the previous occurrence.
    assert master.created_at == newest.completed_at
    assert newest.created_at == older.completed_at
    assert older.created_at == resolve_series_created(NOW)


def resolve_series_created(now):
    return Clock(tz=LONDON, now=now).resolve_datetime("D-40 09:00")


def test_missing_n_means_skipped_occurrence_with_no_row():
    dataset = resolve(recurring(history={"n": [1, 3], "series_created": "D-40 09:00"}), NOW)
    starts = sorted(r.start_at for r in dataset.rows if r.is_history)
    assert len(starts) == 2
    assert (dataset.rows[0].start_at - starts[0]) == timedelta(weeks=3)


@pytest.mark.parametrize(
    "overrides",
    [
        {"history": {"n": [1, 1], "series_created": "D-40 09:00"}},
        {"history": {"n": [0], "series_created": "D-40 09:00"}},
        {"history": {"n": [], "series_created": "D-40 09:00"}},
        {"repeat": {"by": "hourly", "until": None}},
        {"repeat": {"by": "weekly", "until": "D-30"}},  # ends before first occurrence
    ],
)
def test_invalid_recurring_definitions(overrides):
    with pytest.raises(DemoSeedError):
        resolve(recurring(**overrides), NOW)


def test_explicit_overdue_master_is_allowed():
    fixture = recurring(start="D-1 09:30")
    dataset = resolve(fixture, NOW)
    assert dataset.rows[0].start_at < NOW and dataset.rows[0].completed_at is None


def test_pending_master_starting_in_the_past_via_wrong_spec_is_rejected():
    fixture = recurring(start="W-1 mon 10:00")
    with pytest.raises(DemoSeedError):
        resolve(fixture, NOW)


def test_history_is_deterministic_for_a_seed():
    a = resolve(recurring(history={"n": [1, 2, 3], "done_after_min": 30, "jitter_min": 9, "series_created": "D-40 09:00"}), NOW)
    b = resolve(recurring(history={"n": [1, 2, 3], "done_after_min": 30, "jitter_min": 9, "series_created": "D-40 09:00"}), NOW)
    assert [r.completed_at for r in a.rows] == [r.completed_at for r in b.rows]


def test_finished_series_keeps_master_completed():
    fixture = recurring(
        start="W-1 wed 19:00",
        done="W-1 wed 20:05",
        repeat={"by": "weekly", "until": "W-1 wed"},
    )
    master = resolve(fixture, NOW).rows[0]
    assert master.completed_at is not None and master.is_master
    assert master.created_at < master.completed_at


# --- the committed fixture -------------------------------------------------- #


def committed_dataset(now):
    return resolve(load_fixture(), now, now.date())


def test_committed_fixture_is_coherent():
    dataset = committed_dataset(NOW)
    rows = dataset.rows
    assert len(rows) > 100
    categories = {r.category for r in rows}
    assert len(categories) == 11

    masters = [i for i, r in enumerate(rows) if r.is_master]
    assert {r.repeat_by for r in rows if r.is_master} == {"daily", "weekly", "monthly", "yearly"}
    assert all(rows[r.master].is_master for r in rows if r.is_history)
    assert all(r.master in masters for r in rows if r.is_history)

    completed = [r for r in rows if r.completed_at]
    overdue = [r for r in rows if not r.completed_at and r.end_at < NOW and not r.is_master]
    upcoming = [r for r in rows if not r.completed_at and r.start_at > NOW and not r.is_history]
    assert len(completed) > 40 and len(overdue) >= 7 and len(upcoming) > 20
    # Overdue items span days to weeks, so every overdue bucket the chart shows is exercised.
    ages = sorted((NOW - r.end_at).days for r in overdue)
    assert ages[0] <= 3 and ages[-1] > 30


def hourly_sweep():
    start = datetime(2026, 10, 22, 0, 0)  # across the autumn clock change (25 Oct)
    for hours in range(0, 24 * 12):
        yield start + timedelta(hours=hours)
    start = datetime(2026, 3, 25, 0, 0)  # and the spring one (29 Mar)
    for hours in range(0, 24 * 8):
        yield start + timedelta(hours=hours)


def test_committed_fixture_resolves_for_every_hour_across_dst_weeks():
    for now in hourly_sweep():
        dataset = committed_dataset(now)
        for r in dataset.rows:
            assert r.end_at > r.start_at
            if r.completed_at:
                assert r.completed_at <= now, (now, r.title)
                assert r.completed_at > r.created_at, (now, r.title)
            else:
                assert not r.is_history
            if r.is_history:
                assert dataset.rows[r.master].is_master
        for r in dataset.rows:
            if r.is_master and not r.completed_at and r.title not in {"Water the plants and tidy the desk"}:
                assert r.start_at > now, (now, r.title)


def test_dropping_a_fixture_key_is_reported():
    fixture = copy.deepcopy(load_fixture())
    fixture["tasks"][1]["surprise"] = True
    with pytest.raises(DemoSeedError):
        resolve(fixture, NOW)
