from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from typing import cast, Any

from app.services import notification as notification_service
from app.schemas.notification_schema import (
    NotificationSchema,
    SubscriptionCreateSchema,
)

notification_bp = Blueprint("notifications", __name__)


@notification_bp.route("/api/notifications", methods=["GET"])
@jwt_required()
def get_notifications_route():
    user_id = get_jwt_identity()

    notifications = notification_service.get_notifications(user_id)

    return jsonify(NotificationSchema(many=True).dump(notifications)), 200


@notification_bp.route(
    "/api/notifications/<int:notification_id>/read", methods=["PATCH"]
)
@jwt_required()
def read_notification(notification_id):
    user_id = get_jwt_identity()

    notification = notification_service.read_notifications(user_id, notification_id)

    if not notification:
        return jsonify({"error": "Notification not found."}), 404

    return jsonify(NotificationSchema().dump(notification)), 200


@notification_bp.route("/api/notifications/subscribe", methods=["POST"])
@jwt_required()
def save_subscription_route():
    user_id = get_jwt_identity()

    try:
        raw_data = SubscriptionCreateSchema().load(request.json)
        data = cast(dict[str, Any], raw_data)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    notification_service.save_subscription(
        user_id=user_id,
        endpoint=data["endpoint"],
        p256dh=data["keys"]["p256dh"],
        auth=data["keys"]["auth"],
    )

    return jsonify({"status": "ok"}), 201
