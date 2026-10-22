from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, auto_field
from marshmallow import Schema, fields, pre_load, validate
from ..models import Notification
import re


class NotificationSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Notification

    @pre_load
    def camel_to_snake(self, data, many, partial, **kwargs):
        return {self._to_snake(k): v for k, v in data.items()}

    def _to_snake(self, s):
        return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower()

    id = auto_field(dump_only=True)
    user_id = auto_field(dump_only=True)

    title = auto_field(
        error_messages={
            "required": "Title is required.",
        },
    )

    message = auto_field(
        error_messages={
            "required": "Message is required.",
        },
    )

    is_read = auto_field()


class SubscriptionKeysSchema(Schema):
    p256dh = fields.String(
        required=True,
        validate=validate.Length(max=255),
        error_messages={
            "required": "p256dh key is required.",
        },
    )
    auth = fields.String(
        required=True,
        validate=validate.Length(max=255),
        error_messages={
            "required": "Auth key is required.",
        },
    )


class SubscriptionCreateSchema(Schema):
    @pre_load
    def camel_to_snake(self, data, many, partial, **kwargs):
        return {self._to_snake(k): v for k, v in data.items()}

    def _to_snake(self, s):
        return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower()

    endpoint = fields.String(
        required=True,
        validate=[
            validate.Length(max=500),
            validate.Regexp(r"^https://", error="Endpoint must be an https URL."),
        ],
        error_messages={
            "required": "Endpoint is required.",
        },
    )

    keys = fields.Nested(
        SubscriptionKeysSchema,
        required=True,
        error_messages={
            "required": "Subscription keys are required.",
        },
    )
