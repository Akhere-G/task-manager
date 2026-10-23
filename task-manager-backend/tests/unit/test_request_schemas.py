import pytest
from marshmallow import ValidationError

from app.schemas.ai_schema import DecomposeSchema, ParseTaskSchema
from app.schemas.contact_schema import ContactSchema
from app.utils.http import flatten_errors

ENQUIRY = {
    "fullName": "Ann Visitor",
    "email": "ann@example.com",
    "subject": "Bug report",
    "message": "Something is broken on the page.",
}


def errors_for(schema, data):
    with pytest.raises(ValidationError) as caught:
        schema.load(data)
    return flatten_errors(caught.value.messages)


def test_valid_enquiry_is_accepted():
    assert ContactSchema().load(ENQUIRY)["email"] == "ann@example.com"


@pytest.mark.parametrize(
    "change, field",
    [
        ({"fullName": "A\nB"}, "fullName"),
        ({"email": "nope"}, "email"),
        ({"subject": ""}, "subject"),
        ({"message": "short"}, "message"),
        ({"message": "x" * 2001}, "message"),
        ({"email": 5}, "email"),
    ],
)
def test_invalid_enquiry_names_the_field(change, field):
    assert field in errors_for(ContactSchema(), {**ENQUIRY, **change})


@pytest.mark.parametrize("text", ["", "   ", "x" * 501, 5])
def test_parse_request_rejects_bad_text(text):
    assert "text" in errors_for(ParseTaskSchema(), {"text": text})


def test_decompose_accepts_the_camel_case_dates_the_frontend_sends():
    data = DecomposeSchema().load(
        {"title": "Plan trip", "category": "social", "startAt": "2026-03-02", "endAt": "2026-03-03"}
    )
    assert data["startAt"] == "2026-03-02"


@pytest.mark.parametrize(
    "body, field",
    [
        ({"title": ""}, "title"),
        ({"title": "x" * 256}, "title"),
        ({"title": "Plan", "description": "x" * 2001}, "description"),
        ({"title": "Plan", "category": "not-a-category"}, "category"),
    ],
)
def test_invalid_decompose_request_names_the_field(body, field):
    assert field in errors_for(DecomposeSchema(), body)
