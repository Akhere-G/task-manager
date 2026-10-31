import logging
import os
from datetime import timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
    verify_jwt_in_request,
)
from app.exceptions import (
    AlreadySignedIn,
    DemoUnavailable,
    InvalidCredentials,
)
from app.services.auth_service import (
    create_user,
    login_user,
    get_user,
    get_demo_user,
    is_demo_user,
    create_reset_token,
    verify_reset_token,
    update_password_and_clear_token,
    validate_refresh_token,
    delete_refresh_token,
    create_session,
    rotate_refresh_token,
    purge_expired_sessions,
)
from app.database import db
from app.extensions import email_only, ip_and_email, limiter
from app.schemas.user_schema import (
    EmailSchema,
    LoginSchema,
    PasswordResetSchema,
    RegisterSchema,
    UserSchema,
)
from app.services.mail_service import send_email
from app.utils.cookies import (
    clear_auth_cookies,
    set_access_cookies,
    set_refresh_cookies,
)
from app.utils.http import get_json_body

auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)


def get_password_reset_html(reset_link):
    return f"""
    <div style="background-color: #f8fafc; padding: 40px 20px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 40px; text-align: center;">
            <h1 style="font-size: 24px; font-weight: 900; color: #4f46e5; letter-spacing: -0.05em; margin-bottom: 24px;">
                Task<span style="color: #0f172a;">Flow</span>
            </h1>
            
            <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
            <p style="color: #64748b; margin: 20px 0;">We received a request to reset your password. Click the button below to choose a new one.</p>
            <a href="{reset_link}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">If you did not request this, please ignore this email. This link expires in 15 minutes.</p>
        </div>
    </div>
    """


def _access_token(user):
    return create_access_token(identity=str(user.id), expires_delta=timedelta(hours=24))


def _session_response(user, message, status=200):
    """A response carrying the user and fresh access and refresh cookies."""
    response = jsonify({"message": message, "user": UserSchema().dump(user)})
    set_refresh_cookies(response, create_session(user.id))
    set_access_cookies(response, _access_token(user))
    response.status_code = status
    return response


@auth_bp.route("/api/auth/register", methods=["POST"])
@limiter.limit("5 per hour")
def register():
    data = RegisterSchema().load(get_json_body())
    user = create_user(
        data["first_name"], data["last_name"], data["email"], data["password"]
    )
    return _session_response(user, "User registered and logged in successfully.", 201)


@auth_bp.route("/api/auth/login", methods=["POST"])
@limiter.limit("10 per minute")
@limiter.limit("5 per 15 minutes", key_func=ip_and_email)
def login():
    data = LoginSchema().load(get_json_body())
    user = login_user(data["email"], data["password"])
    if not user:
        raise InvalidCredentials()

    try:
        purge_expired_sessions(user.id)
    except Exception:
        db.session.rollback()
        logger.exception("Could not purge expired sessions")

    return _session_response(user, "Login successful.")


@auth_bp.route("/api/auth/demo", methods=["POST"])
@limiter.limit("20 per hour")
def demo_login():
    try:
        verify_jwt_in_request(optional=True)
        current_user_id = get_jwt_identity()
    except Exception:
        current_user_id = None

    if current_user_id and not is_demo_user(current_user_id):
        raise AlreadySignedIn()

    user = get_demo_user()
    if not user:
        raise DemoUnavailable()

    return _session_response(user, "Demo session started.")


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        delete_refresh_token(refresh_token)
    response = jsonify({"message": "Logout successful."})
    clear_auth_cookies(response)
    return response


@auth_bp.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_me():
    current_user_id = get_jwt_identity()
    user = get_user(current_user_id)
    if user:
        return jsonify({"message": "Logged in.", "user": UserSchema().dump(user)})
    return jsonify({"message": "An error occurred.", "user": None}), 400


def send_password_reset_email(user, email, token):
    frontend_url = (os.getenv("FRONTEND_URL") or "").rstrip("/")
    if not frontend_url:
        raise RuntimeError("FRONTEND_URL is not configured")

    send_email(
        sender_name="Task Manager Support",
        to=(email, user.first_name),
        subject="Reset your password",
        html=get_password_reset_html(f"{frontend_url}/reset-password?token={token}"),
    )


@auth_bp.route("/api/auth/request-password-reset", methods=["POST"])
@limiter.limit("3 per hour")
@limiter.limit("3 per hour", key_func=email_only)
def request_password_reset():
    email = EmailSchema().load(get_json_body())["email"]
    user = get_user(email=email)

    if user and not user.is_demo:
        token = create_reset_token(user.id)
        try:
            send_password_reset_email(user, email, token)
        except Exception as exc:
            logger.error(
                "Password reset email could not be sent: %s", type(exc).__name__
            )

    return jsonify({"message": "If an account exists, a reset link has been sent."})


@auth_bp.route("/api/auth/reset-password", methods=["POST"])
@limiter.limit("10 per hour")
def reset_password():
    data = PasswordResetSchema().load(get_json_body())

    user_id = verify_reset_token(data["token"])
    if not user_id:
        return jsonify({"message": "Invalid or expired reset link"}), 400

    if not update_password_and_clear_token(user_id, data["token"], data["password"]):
        return jsonify({"message": "Could not update password"}), 500

    return jsonify({"message": "Password updated successfully"})


@auth_bp.route("/api/auth/refresh", methods=["POST"])
@limiter.limit("60 per minute")
def refresh():
    refresh_token = request.cookies.get("refresh_token")

    user = validate_refresh_token(refresh_token)
    if not user:
        return jsonify({"message": "Unauthorized"}), 401

    new_refresh_token = rotate_refresh_token(refresh_token, user.id)

    response = jsonify(
        {"message": "Token refreshed successfully.", "user": UserSchema().dump(user)}
    )
    if new_refresh_token:
        set_refresh_cookies(response, new_refresh_token)
    set_access_cookies(response, _access_token(user))

    return response
