def create_task(session, payload):
    response = session.post("/api/tasks", json=payload)
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def test_user_cannot_touch_another_users_task(make_user, login, task_payload):
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    task_id = create_task(a, task_payload())

    assert b.get(f"/api/tasks/{task_id}").status_code == 404
    assert b.patch(f"/api/tasks/{task_id}", json={"title": "Hijacked"}).status_code == 404
    assert b.delete(f"/api/tasks/{task_id}").status_code == 404

    own = a.get(f"/api/tasks/{task_id}")
    assert own.status_code == 200
    assert own.get_json()["title"] == "Write report"


def test_task_list_only_returns_own_tasks(make_user, login, task_payload):
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    create_task(a, task_payload(title="Alpha task"))
    create_task(b, task_payload(title="Beta task"))

    titles_a = [t["title"] for t in a.get("/api/tasks").get_json()["tasks"]]
    titles_b = [t["title"] for t in b.get("/api/tasks").get_json()["tasks"]]
    assert titles_a == ["Alpha task"]
    assert titles_b == ["Beta task"]


def test_stats_only_count_own_tasks(make_user, login, task_payload):
    make_user("a@example.com")
    make_user("b@example.com")
    a = login("a@example.com")
    b = login("b@example.com")
    create_task(a, task_payload())
    create_task(a, task_payload(title="Second"))

    stats = b.get("/api/stats/dashboard").get_json()
    assert sum(item["count"] for item in stats["backlogHealth"]) == 0


def test_cannot_read_another_users_notification(app, make_user, login):
    from app.database import db
    from app.models import Notification

    a_id = make_user("a@example.com")
    make_user("b@example.com")
    with app.app_context():
        note = Notification(user_id=a_id, title="Private", message="Only for A")
        db.session.add(note)
        db.session.commit()
        note_id = note.id

    b = login("b@example.com")
    assert b.get("/api/notifications").get_json() == []
    assert b.patch(f"/api/notifications/{note_id}/read").status_code == 404

