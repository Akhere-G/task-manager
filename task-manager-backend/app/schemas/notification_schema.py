from marshmallow import fields, validate
from marshmallow_sqlalchemy import auto_field

from ..models import Notification
from .base import CamelAutoSchema, CamelSchema


class NotificationSchema(CamelAutoSchema):
    class Meta(CamelAutoSchema.Meta):
        model = Notification

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


class SubscriptionKeysSchema(CamelSchema):
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


class SubscriptionCreateSchema(CamelSchema):
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
