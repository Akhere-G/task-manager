from datetime import datetime
import re

def validate_task(data, is_update=False):
    """
    Validates task data.
    :param data: The dictionary of input data.
    :param is_update: If True, fields are optional (for PATCH/PUT).
    :return: A dictionary of errors. Empty if valid.
    """
    errors = {}
    
    VALID_CATEGORIES = [
        "work", "home", "chores", "life-admin", "health", 
        "self-care", "social", "hobbies", "learning", "finance", "general"
    ]

    if 'title' in data or not is_update:
        title = str(data.get('title', '')).strip()
        if not title:
            errors['title'] = "Title is mandatory."
        elif len(title) > 255:
            errors['title'] = "Title must be under 255 characters."

    if 'description' in data or not is_update:
        desc = str(data.get('description', '')).strip()
        if not desc:
            errors['description'] = "Description is mandatory."

    if 'dueDate' in data or not is_update:
        due_date = data.get('dueDate')
        if not due_date:
            errors['dueDate'] = "Due date is mandatory."
        else:
            try:
                datetime.strptime(str(due_date), '%Y-%m-%d')
            except (ValueError, TypeError):
                errors['dueDate'] = "Invalid date format. Please use YYYY-MM-DD."
    
    if 'estimatedTime' in data or not is_update:
        est = data.get('estimatedTime')
        if est in [None, ""]:
            errors['estimatedTime'] = "Estimated time is mandatory."
        else:
            try:
                if int(est) < 1:
                    errors['estimatedTime'] = "Estimated time must be at least 1 minute."
            except (ValueError, TypeError):
                errors['estimatedTime'] = "Estimated time must be a number."

    if 'isCompleted' in data:
        is_comp = data.get('isCompleted')
        if not isinstance(is_comp, bool):
            errors['isCompleted'] = "Completion status must be a boolean (true/false)."

        completed_at = data.get("completedAt")
        if is_comp and not completed_at:
            errors['isCompleted'] = "Must send completed at date if completing task."
        elif not is_comp and completed_at:
            errors['isCompleted'] = "Must send null for completed at date if uncompleting task."

    if 'completedAt' in data and is_update:
        completed_at = data.get('completedAt')
        if completed_at:
            try:
                # Handle the 'Z' suffix if coming from JavaScript's toISOString()
                clean_ts = str(completed_at).replace('Z', '')
                
                # Check for the two most common formats
                if 'T' in clean_ts:
                    datetime.strptime(clean_ts, '%Y-%m-%dT%H:%M:%S')
                else:
                    datetime.strptime(clean_ts, '%Y-%m-%d %H:%M:%S')
                    
            except (ValueError, TypeError):
                errors['completedAt'] = "Invalid timestamp. Use YYYY-MM-DD HH:MM:SS or ISO format."

    if 'category' in data or not is_update:
        cat = str(data.get('category', '')).strip()
        if not cat:
            errors['category'] = "Category is mandatory."
        elif len(cat) > 50:
            errors['category'] = "Category name is too long."
        elif cat not in VALID_CATEGORIES:
            errors['category'] = f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}."

    return errors


def validate_contact_request(data):
    errors = {}
    
    # 1. Full Name Validation
    full_name = data.get('fullName', '').strip()
    if not full_name:
        errors['fullName'] = "Full name is required."
    elif len(full_name) > 100:
        errors['fullName'] = "Name must be under 100 characters."

    # 2. Email Validation
    email = data.get('email', '').strip()
    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not email:
        errors['email'] = "Email address is required."
    elif not re.match(email_regex, email):
        errors['email'] = "Please enter a valid email address."

    # 3. Subject Validation
    subject = data.get('subject', '').strip()
    if not subject:
        errors['subject'] = "Please select a subject for your enquiry."
    elif len(subject) > 100:
        errors['subject'] = "Subject must be under 100 characters."

    # 4. Message Validation
    message = data.get('message', '').strip()
    if not message:
        errors['message'] = "Message content is required."
    elif len(message) < 10:
        errors['message'] = "Please provide a bit more detail (minimum 10 characters)."
    elif len(message) > 2000:
        errors['message'] = "Message exceeds the 2000 character limit."

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
        email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_regex, email):
            errors['email'] = "Please enter a valid email address."

    if password:
        if len(password) < 8:
            errors["password"] = "Password must be at least 8 characters."
        elif len(password) > 50:
            errors["password"] = "Password must be 50 characters or less."
        elif not (re.search(r'[A-Za-z]', password) and re.search(r'[0-9]', password)):
            errors["password"] = "Password must contain both letters and numbers."

    confirm_password = get_clean("confirmPassword")
    if not confirm_password:
        errors["confirmPassword"] = "Confirm password is required."
    elif confirm_password != password:
        errors["confirmPassword"] = "Passwords do not match."

    return errors