from flask import request
from werkzeug.exceptions import BadRequest


def get_json_body(allow_list=False):
    data = request.get_json(silent=True)
    if isinstance(data, dict) or (allow_list and isinstance(data, list)):
        return data
    raise BadRequest("A JSON object is required.")


def _first_message(value):
    if isinstance(value, dict):
        return {key: _first_message(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return _first_message(value[0]) if value else ""
    return value


def flatten_errors(messages):
    return _first_message(messages)


def flatten_item_errors(messages, count):
    return [flatten_errors(messages.get(index, {})) for index in range(count)]
