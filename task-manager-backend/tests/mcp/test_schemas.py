import pytest
from marshmallow import ValidationError

from app.mcp.schemas import EmptySchema, IdSchema, input_json_schema
from app.schemas.label_schema import LabelSchema
from app.schemas.task_schema import TaskSchema, TaskUpdateSchema

pytestmark = pytest.mark.unit


def test_read_only_fields_are_not_inputs() -> None:
    schema = input_json_schema(LabelSchema)

    assert set(schema["properties"]) == {"name", "colour"}
    assert schema["required"] == ["name"]


def test_write_only_fields_stay_but_lose_their_flag() -> None:
    schema = input_json_schema(TaskSchema)

    assert "labelNames" in schema["properties"]
    assert "writeOnly" not in schema["properties"]["labelNames"]
    assert "userId" not in schema["properties"]
    assert "userId" not in schema.get("required", [])


def test_nullable_fields_use_json_schema_types() -> None:
    schema = input_json_schema(TaskSchema)

    assert schema["properties"]["startAt"]["type"] == ["string", "null"]


def test_nested_schemas_are_inlined() -> None:
    reminders = input_json_schema(TaskSchema)["properties"]["reminders"]

    assert reminders["items"]["properties"]["kind"]["enum"] == ["before", "clock"]


def test_an_id_is_added_as_a_required_input_when_a_tool_takes_one() -> None:
    schema = input_json_schema(TaskUpdateSchema, takes_id=True)

    assert schema["properties"]["id"] == {"type": "integer", "minimum": 1}
    assert schema["required"] == ["id"]


def test_a_tool_with_only_an_id_has_no_other_inputs() -> None:
    schema = input_json_schema(EmptySchema, takes_id=True)

    assert list(schema["properties"]) == ["id"]


def test_the_id_schema_requires_a_positive_id() -> None:
    with pytest.raises(ValidationError, match="id"):
        IdSchema().load({"id": 0})
    with pytest.raises(ValidationError, match="id"):
        IdSchema().load({})
