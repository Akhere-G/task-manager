import pytest
from marshmallow import ValidationError

from app.schemas.query_schema import TaskListQuerySchema
from app.services.task_query import TaskQuery
from app.utils.http import flatten_errors


def errors_for(params):
    with pytest.raises(ValidationError) as caught:
        TaskListQuerySchema().load(params)
    return flatten_errors(caught.value.messages)


def test_empty_query_uses_defaults():
    assert TaskListQuerySchema().load({}) == TaskQuery(page=1)


def test_search_param_maps_to_search_and_blank_values_are_ignored():
    query = TaskListQuerySchema().load({"q": "report", "category": "", "page": ""})
    assert query.search == "report" and query.category is None and query.page == 1


@pytest.mark.parametrize(
    "params, field",
    [
        ({"page": "0"}, "page"),
        ({"page": "x"}, "page"),
        ({"limit": "201"}, "limit"),
        ({"start_date": "2026-03-01"}, "start_date"),
        ({"start_date": "2026-03-10", "end_date": "2026-03-01"}, "end_date"),
        ({"project_repeating": "true"}, "project_repeating"),
        (
            {"project_repeating": "true", "start_date": "2026-01-01", "end_date": "2027-12-31"},
            "project_repeating",
        ),
    ],
)
def test_invalid_queries_name_the_field(params, field):
    assert field in errors_for(params)


def test_projection_within_the_limit_is_accepted():
    query = TaskListQuerySchema().load(
        {"project_repeating": "true", "start_date": "2026-03-01", "end_date": "2026-03-10"}
    )
    assert query.project_repeating is True
