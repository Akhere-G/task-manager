from datetime import datetime, timedelta
from typing import Any

import pytest

from app.mcp.tools.stats import STATS_TOOLS
from app.utils.dates import utc_now
from tests.mcp.helpers import REGISTRY, fail, run

pytestmark = pytest.mark.integration

STATS_RESULT_KEYS = {
    "get_productivity_trend": "productivity",
    "get_time_spent": "timeSpent",
    "get_hourly_productivity": "hourlyProductivity",
    "get_turnaround_time": "turnaround",
    "get_estimation_accuracy": "estimationAccuracy",
    "get_distribution_trend": "distributionTrend",
    "get_project_volume": "projectVolume",
    "get_backlog_health": "backlogHealth",
    "get_overdue_distribution": "overdueDistribution",
    "get_deadline_proximity": "deadlineProximity",
    "get_week_overview": "weekOverview",
}


def stamp(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%d %H:%M:%S")


def add_task(user_id: int, ends_in: timedelta, **extra: Any) -> dict[str, Any]:
    end = utc_now().replace(microsecond=0) + ends_in
    return run(
        user_id,
        "create_task",
        title="Task",
        startAt=stamp(end - timedelta(hours=1)),
        endAt=stamp(end),
        **extra,
    )


def complete(user_id: int, task: dict[str, Any]) -> None:
    run(user_id, "update_task", id=task["id"], isCompleted=True)


def test_every_stat_has_a_tool() -> None:
    assert {tool.name for tool in STATS_TOOLS} == set(STATS_RESULT_KEYS)


@pytest.mark.parametrize(("tool", "key"), STATS_RESULT_KEYS.items())
def test_a_new_user_gets_an_empty_but_valid_result(
    user_id: int, tool: str, key: str
) -> None:
    result = run(user_id, tool)

    assert list(result) == [key]
    assert isinstance(result[key], list)


def test_stats_tools_only_read() -> None:
    hints = {tool.name: tool.definition()["annotations"] for tool in REGISTRY}

    for name in STATS_RESULT_KEYS:
        assert hints[name]["readOnlyHint"] is True


def test_the_productivity_trend_defaults_to_a_month_ending_today(
    user_id: int,
) -> None:
    days = run(user_id, "get_productivity_trend")["productivity"]

    assert len(days) == 30
    assert days[-1]["date"] == utc_now().date().isoformat()
    assert set(days[0]) == {"date", "tasks", "timeSpent"}


def test_the_productivity_trend_honours_days(user_id: int) -> None:
    assert len(run(user_id, "get_productivity_trend", days=7)["productivity"]) == 7
    assert len(run(user_id, "get_productivity_trend", days=366)["productivity"]) == 366
    assert "days" in str(fail(user_id, "get_productivity_trend", days=0))
    assert "days" in str(fail(user_id, "get_productivity_trend", days=367))


def test_completed_tasks_count_towards_the_trend_time_and_projects(
    user_id: int,
) -> None:
    done = add_task(user_id, timedelta(hours=-2), projectName="Work")
    add_task(user_id, timedelta(days=3), projectName="Work")
    complete(user_id, done)

    today = run(user_id, "get_productivity_trend", days=1)["productivity"][0]
    assert (today["tasks"], today["timeSpent"]) == (1, 60)
    assert run(user_id, "get_time_spent")["timeSpent"] == [
        {"project": "Work", "timeSpent": 60}
    ]
    hours = run(user_id, "get_hourly_productivity")["hourlyProductivity"]
    assert sum(entry["count"] for entry in hours) == 1
    turnaround = run(user_id, "get_turnaround_time")["turnaround"]
    assert turnaround[0] == {"daysTaken": 0, "count": 1}
    spread = run(user_id, "get_distribution_trend")["distributionTrend"]
    assert spread[-1]["counts"] == [{"project": "Work", "count": 1}]


def test_volume_and_backlog_health_agree(user_id: int) -> None:
    complete(user_id, add_task(user_id, timedelta(hours=-2), projectName="Work"))
    add_task(user_id, timedelta(days=-2), projectName="Work")
    add_task(user_id, timedelta(days=3), projectName="Home")

    volume = run(user_id, "get_project_volume")["projectVolume"]
    by_project = {row["project"]: row for row in volume}
    assert by_project["Work"] == {
        "project": "Work",
        "completed": 1,
        "overdue": 1,
        "pending": 0,
        "total": 2,
    }
    assert by_project["Home"]["pending"] == 1
    health = run(user_id, "get_backlog_health")["backlogHealth"]
    assert {row["status"]: row["count"] for row in health} == {
        "Completed": 1,
        "Overdue": 1,
        "Pending": 1,
    }


def test_overdue_tasks_fall_into_a_bucket(user_id: int) -> None:
    add_task(user_id, timedelta(days=-2))

    buckets = run(user_id, "get_overdue_distribution")["overdueDistribution"]

    assert buckets == [{"daysOverdue": "< 3 Days", "count": 1}]


def test_the_week_overview_and_deadlines_cover_open_tasks(user_id: int) -> None:
    add_task(user_id, timedelta(hours=30), projectName="Work")

    week = run(user_id, "get_week_overview")["weekOverview"]
    assert sum(day["count"] for day in week) == 1
    assert week[0]["totalMinutes"] == 60
    assert week[0]["totalHours"] == "1.00"
    proximity = run(user_id, "get_deadline_proximity")["deadlineProximity"]
    assert proximity[0]["project"] == "Work"
    assert 1 < proximity[0]["score"] < 2


def test_estimation_accuracy_lists_recent_completions(user_id: int) -> None:
    complete(user_id, add_task(user_id, timedelta(hours=1)))

    entries = run(user_id, "get_estimation_accuracy")["estimationAccuracy"]

    assert len(entries) == 1
    assert 55 <= entries[0]["varianceMinutes"] <= 60
    assert set(entries[0]) == {
        "id",
        "title",
        "project",
        "estimatedAt",
        "completedAt",
        "varianceMinutes",
    }


def test_subtasks_and_trashed_tasks_are_not_counted(user_id: int) -> None:
    parent = add_task(user_id, timedelta(days=3))
    run(user_id, "add_subtasks", id=parent["id"], subtasks=[{"title": "Step"}])
    trashed = add_task(user_id, timedelta(days=3))
    run(user_id, "delete_task", id=trashed["id"])

    health = run(user_id, "get_backlog_health")["backlogHealth"]

    assert {row["status"]: row["count"] for row in health}["Pending"] == 1
