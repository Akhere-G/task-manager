from datetime import datetime

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

    if 'category' in data or not is_update:
        cat = str(data.get('category', '')).strip()
        if not cat:
            errors['category'] = "Category is mandatory."
        elif len(cat) > 50:
            errors['category'] = "Category name is too long."
        elif cat not in VALID_CATEGORIES:
            errors['category'] = f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}."

    return errors