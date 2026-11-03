from datetime import timedelta
from typing import Any

import pytest
from flask.testing import FlaskClient

from app.utils.dates import utc_now

pytestmark = pytest.mark.integration


def at_day(offset: int, hour: int = 12) -> dict[str, str]:
    start = (utc_now() + timedelta(days=offset)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )
    return {
        "startAt": start.isoformat(),
        "endAt": (start + timedelta(minutes=30)).isoformat(),
    }


def add(session: FlaskClient, title: str, **extra: Any) -> dict:
    response = session.post("/api/tasks", json={"title": title, **extra})
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def titles(session: FlaskClient, query: str) -> list[str]:
    response = session.get(f"/api/tasks?zone=UTC&{query}")
    assert response.status_code == 200, response.get_json()
    return [task["title"] for task in response.get_json()["tasks"]]


def test_overdue_lists_only_open_tasks_that_have_ended(session: FlaskClient) -> None:
    add(session, "late", **at_day(-3))
    add(session, "done late", isCompleted=True, **at_day(-3))
    add(session, "later", **at_day(3))

    assert titles(session, "view=overdue&is_completed=all") == ["late"]


def test_upcoming_starts_tomorrow_and_stops_after_two_weeks(
    session: FlaskClient,
) -> None:
    add(session, "tomorrow", **at_day(1))
    add(session, "in a fortnight", **at_day(14))
    add(session, "too far", **at_day(20))
    add(session, "yesterday", **at_day(-1))

    found = titles(session, "view=upcoming&sort_by=start_at")

    assert found == ["tomorrow", "in a fortnight"]


def test_a_view_combines_with_the_other_filters(session: FlaskClient) -> None:
    add(session, "urgent", priority=1, **at_day(1))
    add(session, "casual", **at_day(1))

    assert titles(session, "view=upcoming&priority=1") == ["urgent"]


def test_upcoming_includes_repeating_ghosts(session: FlaskClient) -> None:
    add(session, "daily", repeatBy="daily", **at_day(0, hour=23))

    found = titles(session, "view=upcoming&project_repeating=true")

    assert found.count("daily") == 14


def test_ghost_pages_are_cut_from_the_combined_list(session: FlaskClient) -> None:
    add(session, "daily", repeatBy="daily", **at_day(0, hour=23))

    response = session.get(
        "/api/tasks?zone=UTC&view=upcoming&project_repeating=true"
        "&sort_by=start_at&limit=10&page=2"
    )
    page = response.get_json()

    assert (page["totalTasks"], page["totalPages"], len(page["tasks"])) == (14, 2, 4)


def test_counts_cover_each_smart_view(session: FlaskClient) -> None:
    add(session, "inbox late", **at_day(-2))
    add(session, "tomorrow", **at_day(1))
    add(session, "done", isCompleted=True, **at_day(1))

    counts = session.get("/api/tasks/counts?zone=UTC").get_json()["counts"]

    assert counts["inbox"] == 2
    assert counts["overdue"] == 1
    assert counts["upcoming"] == 1


def test_counts_match_the_listed_views_with_repeating_ghosts(
    session: FlaskClient,
) -> None:
    add(session, "daily", repeatBy="daily", **at_day(0, hour=23))
    add(session, "tomorrow", **at_day(1))

    counts = session.get("/api/tasks/counts?zone=UTC").get_json()["counts"]

    for view in ("today", "upcoming", "week", "month"):
        listed = session.get(
            f"/api/tasks?zone=UTC&view={view}&project_repeating=true"
        ).get_json()["totalTasks"]
        assert counts[view] == listed, view


@pytest.mark.parametrize("query", ["view=someday", "zone=Mars/Base"])
def test_unknown_views_and_zones_are_rejected(session: FlaskClient, query: str) -> None:
    assert session.get(f"/api/tasks?{query}").status_code == 400
