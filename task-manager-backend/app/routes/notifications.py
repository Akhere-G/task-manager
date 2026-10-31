from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services import notification as notification_service
from app.exceptions import DemoForbidden
from app.services.auth_service import is_demo_user
from app.utils.http import get_json_body
from app.schemas.notification_schema import (
    NotificationSchema,
    SubscriptionCreateSchema,
)

notification_bp = Blueprint("notifications", __name__)


@notification_bp.route("/api/notifications", methods=["GET"])
@jwt_required()
def get_notifications_route():
    user_id = get_jwt_identity()

    limit = request.args.get("limit", default=50, type=int)
    before_id = request.args.get("before_id", type=int)
    if limit is None or not 1 <= limit <= 100:
        return jsonify({"errors": {"limit": "limit must be between 1 and 100."}}), 400

    notifications = notification_service.get_notifications(user_id, limit, before_id)

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

    if is_demo_user(user_id):
        raise DemoForbidden()

    data = SubscriptionCreateSchema().load(get_json_body())

    notification_service.save_subscription(
        user_id=user_id,
        endpoint=data["endpoint"],
        p256dh=data["keys"]["p256dh"],
        auth=data["keys"]["auth"],
    )

    return jsonify({"status": "ok"}), 201


@notification_bp.route("/api/notifications/subscribe", methods=["DELETE"])
@jwt_required()
def delete_subscription_route():
    user_id = get_jwt_identity()
    endpoint = get_json_body().get("endpoint")

    if not isinstance(endpoint, str) or not endpoint:
        return jsonify({"errors": {"endpoint": "Endpoint is required."}}), 400

    notification_service.delete_subscription(user_id, endpoint)
    return jsonify({"status": "ok"}), 200
