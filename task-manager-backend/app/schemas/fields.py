from dateutil import parser
from marshmallow import fields

from app.utils.dates import as_naive_utc, to_iso_z


class StrippedString(fields.String):
    def _deserialize(self, value, attr, data, **kwargs):
        return super()._deserialize(value, attr, data, **kwargs).strip()


class IsoDateTime(fields.DateTime):
    """Accepts anything `dateutil.parser.isoparse` does, e.g. `2026-03-02 10:00`."""

    default_error_messages = {"invalid": "Invalid date. Use ISO format."}

    def _deserialize(self, value, attr, data, **kwargs):
        if not isinstance(value, str):
            raise self.make_error("invalid")
        try:
            return parser.isoparse(value)
        except ValueError:
            raise self.make_error("invalid") from None


class UtcDateTime(IsoDateTime):
    """Naive UTC in the database, ISO 8601 with a trailing Z on the way out."""

    def _deserialize(self, value, attr, data, **kwargs):
        return as_naive_utc(super()._deserialize(value, attr, data, **kwargs))

    def _serialize(self, value, attr, obj, **kwargs):
        return None if value is None else to_iso_z(value)
