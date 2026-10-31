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


class TaskConflict(AppError):
    status_code = 409
    message = "This task was already updated."

    def __init__(self, task: dict[str, Any]) -> None:
        super().__init__(task=task)


class InvalidTaskTimes(AppError):
    field = "endAt"
    message = "End time must be after the start time."


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
