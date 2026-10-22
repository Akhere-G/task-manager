from flask import request
from werkzeug.exceptions import BadRequest


def get_json_body(allow_list=False):
    data = request.get_json(silent=True)
    if isinstance(data, dict) or (allow_list and isinstance(data, list)):
        return data
    raise BadRequest("A JSON object is required.")
