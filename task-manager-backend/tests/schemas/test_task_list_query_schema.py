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
    ],
)
def test_bad_filters_are_rejected(args: dict[str, str], field: str) -> None:
    assert field in load_errors(TaskListQuerySchema(), args)


def test_a_bounded_range_can_project_repeating_tasks() -> None:
    query = TaskListQuerySchema().load(
        {
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "project_repeating": "true",
        }
    )

    assert query.project_repeating is True


def test_priorities_are_read_as_a_sorted_set() -> None:
    query = TaskListQuerySchema().load({"priority": "3, 1,3"})

    assert query.priority == (1, 3)


@pytest.mark.parametrize("priority", ["0", "5", "high", "1,", "1;2"])
def test_bad_priorities_are_rejected(priority: str) -> None:
    assert "priority" in load_errors(TaskListQuerySchema(), {"priority": priority})


def test_a_project_filter_is_a_positive_id() -> None:
    assert TaskListQuerySchema().load({"project": "12"}).project == 12
    assert "project" in load_errors(TaskListQuerySchema(), {"project": "0"})
    assert "project" in load_errors(TaskListQuerySchema(), {"project": "work"})
