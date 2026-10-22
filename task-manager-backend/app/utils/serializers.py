TASK_FIELDS = (
    "id",
    "title",
    "description",
    "category",
    "is_completed",
    "start_at",
    "end_at",
    "created_at",
    "completed_at",
    "is_repeating",
    "repeat_by",
    "repeat_until",
    "series_id",
    "user_id",
)


def task_to_dict(task):
    return {field: getattr(task, field) for field in TASK_FIELDS}
