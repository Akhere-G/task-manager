from typing import Any

from app.utils.dates import to_iso_z


def to_camel_case(snake_case: str) -> str:
    first, *rest = snake_case.split("_")
    return first + "".join(word.title() for word in rest)


def format_json_response(data: Any) -> Any:
    if data is None:
        return None
    if isinstance(data, list):
        return [format_json_response(item) for item in data]
    if isinstance(data, dict):
        return {
            to_camel_case(key): format_json_response(value)
            for key, value in data.items()
        }
    return to_iso_z(data)
