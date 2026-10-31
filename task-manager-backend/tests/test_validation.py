from collections.abc import Callable

from flask.testing import FlaskClient

from tests.conftest import DEFAULT_PASSWORD

REGISTER = {
    "firstName": "New",
    "lastName": "Person",
    "email": "new@example.com",
    "password": DEFAULT_PASSWORD,
    "confirmPassword": DEFAULT_PASSWORD,
}


def test_register_returns_every_field_error_as_400(client: FlaskClient) -> None:
    response = client.post("/api/auth/register", json={})

    assert response.status_code == 400
    assert set(response.get_json()["errors"]) == {
        "firstName",
        "lastName",
        "email",
        "password",
        "confirmPassword",
    }


def test_register_stores_trimmed_names_and_email(client: FlaskClient) -> None:
    body = {**REGISTER, "firstName": "  Ann ", "email": " ann@example.com "}

    user = client.post("/api/auth/register", json=body).get_json()["user"]

    assert (user["firstName"], user["email"]) == ("Ann", "ann@example.com")


def test_wrong_login_is_a_general_error(
    client: FlaskClient, make_user: Callable[..., int]
) -> None:
    make_user()
    body = {"email": "user@example.com", "password": "nope-nope1"}

    response = client.post("/api/auth/login", json=body)

    assert response.status_code == 400
    assert response.get_json()["errors"] == {"general": "Invalid credentials."}
