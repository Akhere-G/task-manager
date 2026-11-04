from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient

from app.constants import MAX_LABELS_PER_TASK, MAX_PROJECT_DEPTH

TaskPayload = Callable[..., dict[str, Any]]


def create(session: FlaskClient, task_payload: TaskPayload, **extra: Any) -> Any:
    return session.post("/api/tasks", json=task_payload(**extra))


def projects(session: FlaskClient) -> list[dict[str, Any]]:
    return session.get("/api/projects").get_json()["projects"]


def labels(session: FlaskClient) -> list[dict[str, Any]]:
    return session.get("/api/labels").get_json()["labels"]


def test_a_new_project_name_creates_the_project(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    response = create(session, task_payload, projectName="Garden")

    assert response.status_code == 201
    [project] = projects(session)
    assert project["name"] == "Garden" and project["parentId"] is None
    assert response.get_json()["projectId"] == project["id"]


def test_an_existing_project_is_reused_ignoring_case(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    existing = session.post("/api/projects", json={"name": "Garden"}).get_json()

    response = create(session, task_payload, projectName="  garden ")

    assert response.get_json()["projectId"] == existing["id"]
    assert len(projects(session)) == 1


def test_a_project_path_creates_and_reuses_each_level(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    work = session.post("/api/projects", json={"name": "Work"}).get_json()

    response = create(session, task_payload, projectName="work / Website / Blog")

    by_name = {p["name"]: p for p in projects(session)}
    assert set(by_name) == {"Work", "Website", "Blog"}
    assert by_name["Work"]["id"] == work["id"]
    assert by_name["Website"]["parentId"] == work["id"]
    assert by_name["Blog"]["parentId"] == by_name["Website"]["id"]
    assert response.get_json()["projectId"] == by_name["Blog"]["id"]


def test_a_path_deeper_than_the_limit_is_rejected_and_creates_nothing(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    path = " / ".join(f"p{i}" for i in range(MAX_PROJECT_DEPTH + 1))

    response = create(session, task_payload, projectName=path)

    assert response.status_code == 400
    assert "projectName" in response.get_json()["errors"]
    assert projects(session) == []


def test_an_empty_path_segment_is_rejected(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    response = create(session, task_payload, projectName="Work //Blog")

    assert response.status_code == 400
    assert projects(session) == []


def test_sending_both_a_project_id_and_name_is_rejected(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    project = session.post("/api/projects", json={"name": "A"}).get_json()

    response = create(session, task_payload, projectId=project["id"], projectName="B")

    assert response.status_code == 400
    assert "projectName" in response.get_json()["errors"]


def test_a_blank_project_name_leaves_the_task_in_the_inbox(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    response = create(session, task_payload, projectName="  ")

    assert response.status_code == 201
    assert response.get_json()["projectId"] is None
    assert projects(session) == []


def test_new_label_names_are_created_and_attached_with_given_ids(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    old = session.post("/api/labels", json={"name": "old"}).get_json()
    session.post("/api/labels", json={"name": "Home", "colour": "#ff0000"})

    response = create(
        session,
        task_payload,
        labelIds=[old["id"]],
        labelNames=["home", "HOME", "fresh"],
    )

    assert response.status_code == 201
    by_name = {label["name"]: label for label in labels(session)}
    assert set(by_name) == {"old", "Home", "fresh"}
    assert by_name["Home"]["colour"] == "#ff0000"
    assert response.get_json()["labelIds"] == sorted(
        [old["id"], by_name["Home"]["id"], by_name["fresh"]["id"]]
    )


def test_too_many_labels_in_total_creates_none(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    ids = [
        session.post("/api/labels", json={"name": f"l{i}"}).get_json()["id"]
        for i in range(MAX_LABELS_PER_TASK)
    ]

    response = create(session, task_payload, labelIds=ids, labelNames=["extra"])

    assert response.status_code == 400
    assert "labelNames" in response.get_json()["errors"]
    assert "extra" not in {label["name"] for label in labels(session)}


def test_editing_a_task_can_create_a_project_and_labels(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    task = create(session, task_payload).get_json()

    response = session.patch(
        f"/api/tasks/{task['id']}",
        json={"projectName": "Garden / Beds", "labelNames": ["soil"]},
    )

    assert response.status_code == 200
    body = response.get_json()
    by_name = {p["name"]: p for p in projects(session)}
    assert body["projectId"] == by_name["Beds"]["id"]
    assert body["labelIds"] == [labels(session)[0]["id"]]


def test_one_user_cannot_reuse_anothers_projects_by_name(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    other = session.application.test_client()
    other.post(
        "/api/auth/register",
        json={
            "firstName": "O",
            "lastName": "T",
            "email": "other@example.com",
            "password": "Sturdy-pass9",
            "confirmPassword": "Sturdy-pass9",
        },
    )
    other.post("/api/projects", json={"name": "Shared"})

    response = create(session, task_payload, projectName="Shared")

    assert response.status_code == 201
    assert len(projects(session)) == 1


def test_a_blank_project_name_does_not_override_the_project_id(
    session: FlaskClient, task_payload: TaskPayload
) -> None:
    project = session.post("/api/projects", json={"name": "Work"}).get_json()

    created = create(
        session, task_payload, projectId=project["id"], projectName=""
    ).get_json()
    assert created["projectId"] == project["id"]

    edited = session.patch(
        f"/api/tasks/{created['id']}",
        json={"projectId": project["id"], "projectName": ""},
    )
    assert edited.get_json()["projectId"] == project["id"]
