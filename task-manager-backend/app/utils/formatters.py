from datetime import datetime, date, timezone
import re


def to_snake_case(s):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower()


def to_camel_case(snake_str):
    """Converts a snake_case string to camelCase."""
    components = snake_str.split("_")

    return components[0] + "".join(x.title() for x in components[1:])


def format_json_response(data):
    """
    Recursively converts dictionary keys from snake_case to camelCase.
    Handles nested dictionaries and lists of dictionaries.
    """
    if data is None:
        return None
    if isinstance(data, list):
        return [format_json_response(i) for i in data]

    if isinstance(data, dict):
        new_dict = {}
        for key, value in data.items():
            new_key = to_camel_case(key)
            new_dict[new_key] = format_json_response(value)
        return new_dict

    if isinstance(data, (datetime, date)):
        if isinstance(data, datetime):
            if data.tzinfo is None:
                data = data.replace(tzinfo=timezone.utc)
            return data.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

        return data.isoformat()

    return data
