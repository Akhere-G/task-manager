from typing import Any

from flask import request
from werkzeug.exceptions import BadRequest


def get_json_body(allow_list: bool = False) -> dict[str, Any] | list[Any]:
    data = request.get_json(silent=True)
    if isinstance(data, dict) or (allow_list and isinstance(data, list)):
        return data
    raise BadRequest("A JSON object is required.")
