from datetime import datetime

from app.utils.formatters import format_json_response


def test_keys_become_camel_case_and_datetimes_utc_iso_at_every_depth() -> None:
    data = {
        "due_at": datetime(2026, 3, 2, 10, 0),
        "sub_tasks": [{"is_done": False, "done_at": None}],
    }

    assert format_json_response(data) == {
        "dueAt": "2026-03-02T10:00:00Z",
        "subTasks": [{"isDone": False, "doneAt": None}],
    }
