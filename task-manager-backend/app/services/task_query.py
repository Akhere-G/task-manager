from dataclasses import dataclass


@dataclass(frozen=True)
class TaskQuery:
    category: str | None = None
    search: str | None = None
    duration: str | None = None
    is_completed: str | bool | None = None
    start_date: str | None = None
    end_date: str | None = None
    sort_by: str | None = None
    order: str | None = None
    limit: int | None = None
    page: int | None = None
    project_repeating: bool = False
