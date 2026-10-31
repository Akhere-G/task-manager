from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class TaskQuery:
    category: str | None = None
    search: str | None = None
    duration: str | None = None
    is_completed: str | bool | None = None
    start_date: str | datetime | None = None
    end_date: str | datetime | None = None
    sort_by: str | None = None
    order: str | None = None
    limit: int | None = None
    page: int | None = None
    project_repeating: bool = False
