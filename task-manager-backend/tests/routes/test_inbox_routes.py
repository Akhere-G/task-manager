from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient


def add_undated(session: FlaskClient, title: str = "Capture", **extra: Any) -> dict:
    response = session.post("/api/tasks", json={"title": title, **extra})
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def titles(session: FlaskClient, query: str = "") -> list[str]:
    response = session.get(f"/api/tasks?is_completed=all&{query}")
    assert response.status_code == 200, response.get_json()
    return [t["title"] for t in response.get_json()["tasks"]]


def test_a_task_needs_only_a_title(session: FlaskClient) -> None:
    task = add_undated(session)

    assert task["startAt"] is None and task["endAt"] is None
    assert task["projectId"] is None


def test_null_dates_make_an_undated_task(session: FlaskClient) -> None:
    task = add_undated(session, startAt=None, endAt=None)

    assert task["startAt"] is None


def test_one_date_without_the_other_is_rejected(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    only_start = session.post(
        "/api/tasks", json={"title": "x", "startAt": "2026-03-02 09:00:00"}
    )
    only_end = session.post(
        "/api/tasks", json={"title": "x", "endAt": "2026-03-02 09:00:00"}
    )

    assert only_start.status_code == 400
    assert only_start.get_json()["errors"]["startAt"]
    assert only_end.status_code == 400


def test_an_undated_repeating_task_is_rejected(session: FlaskClient) -> None:
    response = session.post("/api/tasks", json={"title": "x", "repeatBy": "daily"})

    assert response.status_code == 400
    assert "repeatBy" in response.get_json()["errors"]


def test_a_task_can_gain_and_lose_its_dates(session: FlaskClient) -> None:
    task = add_undated(session)

    dated = session.patch(
        f"/api/tasks/{task['id']}",
        json={"startAt": "2026-03-02 09:00:00", "endAt": "2026-03-02 10:00:00"},
    )
    assert dated.status_code == 200
    assert dated.get_json()["startAt"] == "2026-03-02T09:00:00Z"

    undated = session.patch(
        f"/api/tasks/{task['id']}", json={"startAt": None, "endAt": None}
    )
    assert undated.status_code == 200
    assert undated.get_json()["startAt"] is None


def test_patching_a_single_date_onto_an_undated_task_is_rejected(
    session: FlaskClient,
) -> None:
    task = add_undated(session)

    response = session.patch(
        f"/api/tasks/{task['id']}", json={"startAt": "2026-03-02 09:00:00"}
    )

    assert response.status_code == 400


def test_removing_the_dates_of_a_repeating_task_is_rejected(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    created = session.post("/api/tasks", json=task_payload(repeatBy="daily"))
    task_id = created.get_json()["id"]

    response = session.patch(
        f"/api/tasks/{task_id}", json={"startAt": None, "endAt": None}
    )

    assert response.status_code == 400


def test_the_inbox_view_lists_tasks_without_a_project(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    project = session.post("/api/projects", json={"name": "Work"}).get_json()
    add_undated(session, "loose")
    session.post("/api/tasks", json=task_payload(title="dated loose"))
    session.post(
        "/api/tasks", json=task_payload(title="filed", projectId=project["id"])
    )

    assert sorted(titles(session, "view=inbox")) == ["dated loose", "loose"]


def test_an_unknown_view_is_rejected(session: FlaskClient) -> None:
    assert session.get("/api/tasks?view=nope").status_code == 400


def test_undated_tasks_are_left_out_of_date_ranges_and_the_calendar(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    add_undated(session, "loose")
    session.post(
        "/api/tasks",
        json=task_payload(
            title="dated", startAt="2026-03-02 09:00:00", endAt="2026-03-02 10:00:00"
        ),
    )

    ranged = titles(
        session,
        "start_date=2026-03-01&end_date=2026-03-31T23:59:59&project_repeating=true",
    )

    assert ranged == ["dated"]


def test_sorting_by_start_puts_undated_tasks_last(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    add_undated(session, "loose")
    for title, day in (("later", "05"), ("sooner", "02")):
        session.post(
            "/api/tasks",
            json=task_payload(
                title=title,
                startAt=f"2026-03-{day} 09:00:00",
                endAt=f"2026-03-{day} 10:00:00",
            ),
        )

    assert titles(session, "sort_by=start_at&order=asc") == [
        "sooner",
        "later",
        "loose",
    ]
    assert titles(session, "sort_by=start_at&order=desc") == [
        "later",
        "sooner",
        "loose",
    ]
    assert titles(session, "sort_by=duration&order=asc")[-1] == "loose"


def test_an_undated_task_can_be_completed_and_the_stats_still_load(
    session: FlaskClient,
) -> None:
    task = add_undated(session)

    done = session.patch(f"/api/tasks/{task['id']}", json={"isCompleted": True})

    assert done.status_code == 200
    assert done.get_json()["isCompleted"] is True
    assert session.get("/api/stats/dashboard").status_code == 200


def test_the_duration_filter_leaves_out_undated_tasks(
    session: FlaskClient, task_payload: Callable[..., dict[str, Any]]
) -> None:
    add_undated(session, "loose")
    session.post(
        "/api/tasks",
        json=task_payload(
            title="short", startAt="2026-03-02 09:00:00", endAt="2026-03-02 09:30:00"
        ),
    )

    assert titles(session, "duration=short_tasks") == ["short"]
