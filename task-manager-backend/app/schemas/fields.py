from datetime import datetime, timezone

from dateutil import parser
from marshmallow import fields


class Text(fields.String):
    def _deserialize(self, value, attr, data, **kwargs):
        return super()._deserialize(value, attr, data, **kwargs).strip()


class IsoDateTime(fields.String):
    default_error_messages = {"invalid": "Invalid format. Use YYYY-MM-DD HH:MM."}

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        try:
            parser.isoparse(text)
        except (ValueError, TypeError):
            raise self.make_error("invalid")
        return text


class IsoDate(fields.String):
    default_error_messages = {"invalid": "Repeat Until is an invalid date."}

    def _deserialize(self, value, attr, data, **kwargs):
        text = super()._deserialize(value, attr, data, **kwargs)
        try:
            datetime.strptime(text.replace("Z", ""), "%Y-%m-%d")
        except ValueError:
            raise self.make_error("invalid")
        return text


def parse_naive_utc(value):
    parsed = parser.isoparse(value)
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed

