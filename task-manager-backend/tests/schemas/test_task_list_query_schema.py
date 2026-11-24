import pytest

from app.schemas.task_schema import TaskListQuerySchema
from tests.schemas.helpers import load_errors


def test_blank_filters_are_ignored_and_paging_defaults_to_page_one() -> None:
    query = TaskListQuerySchema().load({"project": "", "q": "report"})

    assert query.project is None
    assert query.search == "report"
    assert query.page == 1


@pytest.mark.parametrize(
    "args, field",
    [
        ({"page": "0"}, "page"),
        ({"limit": "201"}, "limit"),
        ({"start_date": "2026-03-01"}, "start_date"),
        ({"start_date": "2026-03-02", "end_date": "2026-03-01"}, "end_date"),
        ({"project_repeating": "true"}, "project_repeating"),
        (
            {
                "start_date": "2026-01-01",
                "end_date": "2027-03-01",
                "project_repeating": "true",
            },
            "project_repeating",
        ),
        ({"group": "someday"}, "group"),
        ({"group": "today", "is_completed": "true"}, "group"),
        ({"view": "nope"}, "view"),
        ({"group": "today", "zone": "Mars/Base"}, "zone"),
        ({"project": "0"}, "project"),
        ({"project": "work"}, "project"),
        ({"column": "7"}, "column"),
        ({"unassigned": "true"}, "column"),
        ({"project": "1", "column": "7", "unassigned": "true"}, "column"),
        ({"project": "1", "column": "0"}, "column"),
        *[({"priority": value}, "priority") for value in ["0", "5", "high", "1,"]],
    ],
)
def test_bad_filters_are_rejected(args: dict[str, str], field: str) -> None:
    assert field in load_errors(TaskListQuerySchema(), args)


def test_filters_are_read_into_their_typed_form() -> None:
    query = TaskListQuerySchema().load(
        {
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "project_repeating": "true",
            "priority": "3, 1,3",
            "project": "1",
            "column": "7",
        }
    )

    assert query.project_repeating is True
    assert query.priority == (1, 3)
    assert (query.project, query.column, query.unassigned) == (1, 7, False)
