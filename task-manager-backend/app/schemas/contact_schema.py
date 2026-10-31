from .base import CamelSchema
from .fields import email, no_line_breaks, text


class ContactSchema(CamelSchema):
    full_name = text(
        "Name", 100, required="Full name is required.",
        extra_validators=[no_line_breaks("Name must be a single line.")],
    )
    email = email(254)
    subject = text(
        "Subject", 100, required="Please select a subject for your enquiry.",
        extra_validators=[no_line_breaks("Subject must be a single line.")],
    )
    message = text(
        "Message", 2000, min_length=10, required="Message content is required.",
        min_message="Please provide a bit more detail (minimum 10 characters).",
    )
