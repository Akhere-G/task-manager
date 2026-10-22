import pytest


@pytest.fixture
def session(make_user, login, task_payload):
    make_user()
    client = login()
    for title, description in [
        ("Quarterly budget report", "Finance numbers"),
        ("Go gym", "Leg day"),
        ("Plan holiday", "Book flights"),
    ]:
        response = client.post(
            "/api/tasks", json=task_payload(title=title, description=description)
        )
        assert response.status_code == 201
    return client


def titles(client, q):
    response = client.get("/api/tasks", query_string={"q": q})
    assert response.status_code == 200, response.get_json()
    return sorted(t["title"] for t in response.get_json()["tasks"])


@pytest.mark.parametrize(
    "q",
    ['foo (bar', '"unclosed', "+-*", "@@@", "()", "~foo", "<<>>", '""', "%", "a_b", "x" * 500],
)
def test_odd_input_never_errors(session, q):
    titles(session, q)


def test_multiple_words_must_all_match(session):
    assert titles(session, "quarterly budget") == ["Quarterly budget report"]
    assert titles(session, "quarterly holiday") == []


def test_prefix_matching(session):
    assert titles(session, "budg") == ["Quarterly budget report"]


def test_short_terms_use_like(session):
    assert titles(session, "go") == ["Go gym"]


def test_percent_is_not_a_wildcard(session):
    assert len(titles(session, "%")) == 3
    assert titles(session, "go%") == []
