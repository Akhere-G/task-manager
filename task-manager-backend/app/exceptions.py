from typing import Any


class AppError(Exception):
    status_code = 400
    message = "Something went wrong."
    field = None

    def __init__(
        self, message: str | None = None, *, field: str | None = None, **extra: Any
    ) -> None:
        self.message = message or self.message
        self.field = field or self.field
        self.extra = extra
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        if self.field:
            return {"errors": {self.field: self.message}}
        return {"error": self.message, **self.extra}


class NotFoundError(AppError):
    status_code = 404
    message = "Not found."


class TaskNotFound(NotFoundError):
    message = "No task with that id exists."

    def __init__(self, task_id: int | None = None) -> None:
        super().__init__(f"No task with the id {task_id} exists." if task_id else None)


class ProjectNotFound(NotFoundError):
    message = "No project with that id exists."


class InvalidProject(AppError):
    field = "projectId"
    message = "Choose one of your own projects."


class ProjectNameTaken(AppError):
    status_code = 409
    field = "name"
    message = "You already have a project with that name here."


class ProjectTooDeep(AppError):
    field = "parentId"
    message = "Projects can only be nested three levels deep."


class ProjectCycle(AppError):
    field = "parentId"
    message = "A project cannot be moved inside itself."


class ColumnNotFound(NotFoundError):
    message = "No column with that id exists."


class InvalidColumn(AppError):
    field = "columnId"
    message = "Choose one of this project's columns."


class ColumnNameTaken(AppError):
    status_code = 409
    field = "name"
    message = "This project already has a column with that name."


class LabelNotFound(NotFoundError):
    message = "No label with that id exists."


class TooManyLabels(AppError):
    field = "labelNames"

    def __init__(self, limit: int) -> None:
        super().__init__(f"A task can have at most {limit} labels.")


class InvalidLabel(AppError):
    field = "labelIds"
    message = "Choose your own labels."


class LabelNameTaken(AppError):
    status_code = 409
    field = "name"
    message = "You already have a label with that name."


class TaskConflict(AppError):
    status_code = 409
    message = "This task was already updated."

    def __init__(self, task: dict[str, Any]) -> None:
        super().__init__(task=task)


class SubtaskParentInvalid(AppError):
    field = "parentId"
    message = "Subtasks can only go under one of your own top-level tasks."


class SubtaskCannotRepeat(AppError):
    field = "repeatBy"
    message = "Subtasks cannot repeat."


class InvalidTaskTimes(AppError):
    field = "endAt"
    message = "End time must be after the start time."


class IncompleteTaskDates(AppError):
    field = "startAt"
    message = "Give both a start and an end time, or neither."


class UndatedRepeatingTask(AppError):
    field = "repeatBy"
    message = "Repeating tasks need a start and an end time."


class InvalidMove(AppError):
    field = "afterId"
    message = "Say which task to move after or before."


class SnoozeNotRepeating(AppError):
    field = "preset"
    message = "Only an open repeating task can move to its next occurrence."


class EmailTaken(AppError):
    field = "general"
    message = "Could not register. Try again or try and sign in."


class InvalidCredentials(AppError):
    field = "general"
    message = "Invalid credentials."


class AlreadySignedIn(AppError):
    status_code = 409
    field = "general"
    message = "Already signed in."


class DemoUnavailable(AppError):
    status_code = 503
    field = "general"
    message = "The demo is temporarily unavailable."


class DemoForbidden(AppError):
    status_code = 403
    message = "Not available in demo mode."


class AIUnavailable(AppError):
    status_code = 502
    message = "The AI service could not complete that request."


class EnquiryNotSent(AppError):
    status_code = 502
    message = "Enquiry could not be sent"
