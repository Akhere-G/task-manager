import re

from app.schemas.constants import VALID_CATEGORIES


def validate_contact_request(data):
    errors = {}

    if not isinstance(data, dict):
        return {"general": "A JSON object is required."}

    def get_text(field):
        value = data.get(field, "")
        return value.strip() if isinstance(value, str) else None

    def has_line_break(value):
        return "\r" in value or "\n" in value

    full_name = get_text("fullName")
    if not full_name:
        errors["fullName"] = "Full name is required."
    elif len(full_name) > 100:
        errors["fullName"] = "Name must be under 100 characters."
    elif has_line_break(full_name):
        errors["fullName"] = "Name must be a single line."

    email = get_text("email")
    email_regex = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    if not email:
        errors["email"] = "Email address is required."
    elif len(email) > 254 or not re.match(email_regex, email):
        errors["email"] = "Please enter a valid email address."

    subject = get_text("subject")
    if not subject:
        errors["subject"] = "Please select a subject for your enquiry."
    elif len(subject) > 100:
        errors["subject"] = "Subject must be under 100 characters."
    elif has_line_break(subject):
        errors["subject"] = "Subject must be a single line."

    message = get_text("message")
    if not message:
        errors["message"] = "Message content is required."
    elif len(message) < 10:
        errors["message"] = "Please provide a bit more detail (minimum 10 characters)."
    elif len(message) > 2000:
        errors["message"] = "Message exceeds the 2000 character limit."

    return errors


MAX_PARSE_TEXT_LENGTH = 500
MAX_DECOMPOSE_TITLE_LENGTH = 255
MAX_DECOMPOSE_DESCRIPTION_LENGTH = 2000


def validate_parse_task(data):
    text = data.get("text")
    if not isinstance(text, str) or not text.strip():
        return {"text": "Text is required."}
    if len(text) > MAX_PARSE_TEXT_LENGTH:
        return {"text": f"Text must be {MAX_PARSE_TEXT_LENGTH} characters or fewer."}
    return {}


def validate_decompose(data):
    errors = {}

    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        errors["title"] = "Title is required."
    elif len(title) > MAX_DECOMPOSE_TITLE_LENGTH:
        errors["title"] = f"Title must be {MAX_DECOMPOSE_TITLE_LENGTH} characters or fewer."

    description = data.get("description")
    if description is not None:
        if not isinstance(description, str):
            errors["description"] = "Description must be text."
        elif len(description) > MAX_DECOMPOSE_DESCRIPTION_LENGTH:
            errors["description"] = (
                f"Description must be {MAX_DECOMPOSE_DESCRIPTION_LENGTH} characters or fewer."
            )

    category = data.get("category")
    if category not in (None, "") and category not in VALID_CATEGORIES:
        errors["category"] = "Invalid category."

    return errors

