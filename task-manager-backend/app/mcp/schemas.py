from typing import Any

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from marshmallow import Schema, fields, validate

from app.schemas.base import CamelSchema

_plugin = MarshmallowPlugin(schema_name_resolver=lambda schema: None)
APISpec(title="mcp", version="1", openapi_version="3.1.0", plugins=[_plugin])


class EmptySchema(CamelSchema):
    pass


class IdSchema(CamelSchema):
    id = fields.Integer(required=True, validate=validate.Range(min=1))


def input_json_schema(
    schema_class: type[Schema], takes_id: bool = False
) -> dict[str, Any]:
    schema = _inputs_only(_plugin.converter.schema2jsonschema(schema_class()))
    if takes_id:
        schema["properties"] = {
            "id": {"type": "integer", "minimum": 1},
            **schema["properties"],
        }
        schema["required"] = ["id", *schema.get("required", [])]
    return schema


def _inputs_only(node: Any) -> Any:
    if isinstance(node, list):
        return [_inputs_only(item) for item in node]
    if not isinstance(node, dict):
        return node
    cleaned = {
        key: _inputs_only(value)
        for key, value in node.items()
        if key not in ("readOnly", "writeOnly")
    }
    properties = cleaned.get("properties")
    if isinstance(properties, dict):
        original = node["properties"]
        cleaned["properties"] = {
            name: value
            for name, value in properties.items()
            if not original[name].get("readOnly")
        }
        required = [
            r for r in cleaned.get("required", []) if r in cleaned["properties"]
        ]
        if required:
            cleaned["required"] = required
        else:
            cleaned.pop("required", None)
    return cleaned
