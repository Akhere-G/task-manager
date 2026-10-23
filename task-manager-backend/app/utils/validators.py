import re

from app.schemas.constants import VALID_CATEGORIES
from app.utils.common_passwords import is_common_password


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


def validate_user(data, is_registering=False):
    errors = {}

    def get_clean(field):
        return str(data.get(field, "")).strip()

    email = get_clean("email")
    password = get_clean("password")

    if not email:
        errors["email"] = "Email is required."

    if not password:
        errors["password"] = "Password is required."

    if not is_registering:
        return errors

    first_name = get_clean("firstName")
    last_name = get_clean("lastName")

    if not first_name:
        errors["firstName"] = "First name is required."
    elif len(first_name) > 50:
        errors["firstName"] = "First name must be 50 characters or less."

    if not last_name:
        errors["lastName"] = "Last name is required."
    elif len(last_name) > 50:
        errors["lastName"] = "Last name must be 50 characters or less."

    if email and len(email) > 100:
        errors["email"] = "Email must be 100 characters or less."
    elif email:
        email_regex = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(email_regex, email):
            errors["email"] = "Please enter a valid email address."

    if password:
        if len(password) < 8:
            errors["password"] = "Password must be at least 8 characters."
        elif len(password) > 50:
            errors["password"] = "Password must be 50 characters or less."
        elif not (re.search(r"[A-Za-z]", password) and re.search(r"[0-9]", password)):
            errors["password"] = "Password must contain both letters and numbers."
        elif is_common_password(password):
            errors["password"] = "That password is too common. Choose a different one."

    confirm_password = get_clean("confirmPassword")
    if not confirm_password:
        errors["confirmPassword"] = "Confirm password is required."
    elif confirm_password != password:
        errors["confirmPassword"] = "Passwords do not match."

    return errors


def validate_password(password):
    if not password:
        return "Password is required."

    if (
        len(password) < 8
        or len(password) > 50
        or not (re.search(r"[A-Za-z]", password) and re.search(r"[0-9]", password))
    ):
        return "Password must be at between 8 and 50 characters and contain letters and numbers. "

    if is_common_password(password):
        return "That password is too common. Choose a different one."

    return None


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

