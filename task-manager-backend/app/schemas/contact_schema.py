from marshmallow import EXCLUDE, Schema, ValidationError, validate

from app.schemas.auth_schema import EMAIL_PATTERN, required_text


def single_line(label):
    def check(value):
        if "\r" in value or "\n" in value:
            raise ValidationError(f"{label} must be a single line.")

    return check


class ContactSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    fullName = required_text(
        "Full name",
        validate.Length(max=100, error="Name must be under 100 characters."),
        single_line("Name"),
    )
    email = required_text(
        "Email address",
        validate.Length(max=254, error="Please enter a valid email address."),
        validate.Regexp(EMAIL_PATTERN, error="Please enter a valid email address."),
    )
    subject = required_text(
        "Subject",
        validate.Length(max=100, error="Subject must be under 100 characters."),
        single_line("Subject"),
        message="Please select a subject for your enquiry.",
    )
    message = required_text(
        "Message content",
        validate.Length(
            min=10, error="Please provide a bit more detail (minimum 10 characters)."
        ),
        validate.Length(max=2000, error="Message exceeds the 2000 character limit."),
    )
