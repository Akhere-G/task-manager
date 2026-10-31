import pytest

from app.schemas.contact_schema import ContactSchema
from tests.builders import CONTACT
from tests.schemas.helpers import load_errors


@pytest.mark.parametrize(
    "override, field, message",
    [
        ({"fullName": ""}, "fullName", "Full name is required."),
        ({"fullName": "A\nB"}, "fullName", "Name must be a single line."),
        ({"subject": "Hi\r\nBcc: x"}, "subject", "Subject must be a single line."),
        (
            {"message": "short"},
            "message",
            "Please provide a bit more detail (minimum 10 characters).",
        ),
        ({"email": 5}, "email", "Not a valid string."),
    ],
)
def test_enquiry_rules(override: dict[str, object], field: str, message: str) -> None:
    assert load_errors(ContactSchema(), {**CONTACT, **override}) == {field: message}
