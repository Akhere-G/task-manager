from datetime import datetime
import re
from dateutil import parser

from app.utils.common_passwords import is_common_password


VALID_CATEGORIES = [
    "work",
    "home",
    "chores",
    "life-admin",
    "health",
    "self-care",
    "social",
    "hobbies",
    "learning",
    "finance",
    "general",
]


def validate_task(data, is_update=False):
    """
    Validates task data.
    :param data: The dictionary of input data.
    :param is_update: If True, fields are optional (for PATCH/PUT).
    :return: A dictionary of errors. Empty if valid.
    """
    errors = {}

    if "title" in data or not is_update:
        title = str(data.get("title", "")).strip()
        if not title:
            errors["title"] = "Title is mandatory."
        elif len(title) > 255:
            errors["title"] = "Title must be under 255 characters."
    dt_start = None
    dt_end = None
    if "startAt" in data or not is_update:
        start_at = data.get("startAt")
        if start_at is None:
            errors["startAt"] = "Start At is mandatory."
        else:
            try:
                dt_start = parser.isoparse(start_at)
            except (ValueError, TypeError):
                errors["startAt"] = "Invalid format. Use YYYY-MM-DD HH:MM."

    if "endAt" in data or not is_update:
        end_val = data.get("endAt")
        if end_val is None:
            errors["endAt"] = "End At is mandatory."
        else:
            try:
                dt_end = parser.isoparse(end_val)
            except (ValueError, TypeError):
                errors["endAt"] = "Invalid format. Use YYYY-MM-DD HH:MM."
    if dt_start and dt_end:
        if dt_end <= dt_start:
            errors["endAt"] = "End time must be after the start time."

    if "isCompleted" in data:
        is_comp = data.get("isCompleted")
        if not isinstance(is_comp, bool):
            errors["isCompleted"] = "Completion status must be a boolean (true/false)."

        completed_at = data.get("completedAt")
        if is_comp and not completed_at:
            errors["isCompleted"] = "Must send completed at date if completing task."
        elif not is_comp and completed_at:
            errors["isCompleted"] = (
                "Must send null for completed at date if uncompleting task."
            )

    if "completedAt" in data and is_update:
        completed_at = data.get("completedAt")
        if completed_at:
            try:
                parser.isoparse(completed_at)
            except (ValueError, TypeError):
                errors["completedAt"] = (
                    "Invalid timestamp. Use YYYY-MM-DD HH:MM:SS or ISO format."
                )

    if "category" in data or not is_update:
        cat = str(data.get("category", "")).strip()
        if not cat:
            errors["category"] = "Category is mandatory."
        elif len(cat) > 50:
            errors["category"] = "Category name is too long."
        elif cat not in VALID_CATEGORIES:
            errors["category"] = (
                f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}."
            )

    if data.get("isRepeating"):
        is_repeating = data.get("isRepeating")
        if not isinstance(is_repeating, bool):
            errors["isRepeating"] = "isRepeating must be a boolean (true/false)."
        if not data.get("repeatBy"):
            errors["repeatBy"] = "Repeat By is required for repeating tasks."

    if data.get("repeatBy"):
        pattern = data.get("repeatBy")
        if pattern not in ["daily", "weekly", "monthly", "yearly"]:
            errors["repeatBy"] = "Repeat must be daily, weekly, monthly or yearly."

    if data.get("repeatUntil"):
        repeat_until = data.get("repeatUntil")

        try:
            clean_ts = str(repeat_until).replace("Z", "")

            if "T" in clean_ts:
                datetime.strptime(clean_ts, "%Y-%m-%d")
            else:
                datetime.strptime(clean_ts, "%Y-%m-%d")

        except (ValueError, TypeError):
            errors["repeatUntil"] = "Repeat Until is an invalid date."
    return errors


def validate_task_list(tasks):
    all_errors = []
    has_errors = False
    for task in tasks:
        errors = validate_task(task)
        all_errors.append(errors)
        has_errors = has_errors or errors

    return all_errors, has_errors


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


MAX_PAGE_SIZE = 200
MAX_TASKS_PER_REQUEST = 2000
MAX_PROJECTION_DAYS = 400


def parse_list_params(args):
    errors = {}

    def parse_int(name, default, minimum, maximum=None):
        raw = args.get(name)
        if raw is None or raw == "":
            return default
        try:
            value = int(raw)
        except (TypeError, ValueError):
            errors[name] = f"{name} must be an integer."
            return default
        if value < minimum or (maximum is not None and value > maximum):
            limits = f"at least {minimum}"
            if maximum is not None:
                limits = f"between {minimum} and {maximum}"
            errors[name] = f"{name} must be {limits}."
            return default
        return value

    page = parse_int("page", 1, 1)
    limit = parse_int("limit", None, 1, MAX_PAGE_SIZE)

    start_date = args.get("start_date") or None
    end_date = args.get("end_date") or None
    start_dt = end_dt = None

    if bool(start_date) != bool(end_date):
        errors["start_date"] = "start_date and end_date must be provided together."
    elif start_date and end_date:
        try:
            start_dt = parser.isoparse(start_date)
        except (ValueError, TypeError):
            errors["start_date"] = "Invalid date. Use ISO format."
        try:
            end_dt = parser.isoparse(end_date)
        except (ValueError, TypeError):
            errors["end_date"] = "Invalid date. Use ISO format."
        if start_dt and end_dt and end_dt < start_dt:
            errors["end_date"] = "end_date must not be before start_date."

    project_repeating = args.get("project_repeating") == "true"
    if project_repeating:
        if not (start_date and end_date):
            errors["project_repeating"] = (
                "project_repeating needs start_date and end_date."
            )
        elif (
            start_dt
            and end_dt
            and (end_dt - start_dt).days > MAX_PROJECTION_DAYS
        ):
            errors["project_repeating"] = (
                f"Date range must be {MAX_PROJECTION_DAYS} days or fewer."
            )

    params = {
        "category": args.get("category"),
        "search": args.get("q"),
        "duration": args.get("duration"),
        "is_completed": args.get("is_completed"),
        "start_date": start_date,
        "end_date": end_date,
        "sort_by": args.get("sort_by"),
        "order": args.get("order"),
        "page": page,
        "limit": limit,
        "project_repeating": project_repeating,
    }
    return params, errors


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

