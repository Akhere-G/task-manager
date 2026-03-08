import os
from flask import Blueprint, request, jsonify
from datetime import timedelta
from services.auth_service import (
    create_user,
    login_user,
    get_user,
    create_reset_token,
    verify_reset_token,
    update_password_and_clear_token,
    validate_refresh_token,
    delete_refresh_token,
    create_session,
    rotate_refresh_token,
)
from utils.validators import validate_user
from flask_jwt_extended import (
    create_access_token,
    unset_jwt_cookies,
    get_jwt_identity,
    jwt_required,
    get_csrf_token,
)
from mailersend import MailerSendClient, EmailBuilder
from utils.validators import validate_password
from utils.formatters import format_json_response

auth_bp = Blueprint("auth", __name__)


def set_refresh_cookies(response, refresh_token):
    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        secure=os.getenv("JWT_COOKIE_SECURE") == "True",
        samesite="None" if os.getenv("JWT_COOKIE_SECURE") == "True" else "Lax",
        path="/",
    )


def set_access_cookies(response, access_token):
    response.set_cookie(
        "access_token_cookie",
        access_token,
        httponly=True,
        secure=os.getenv("JWT_COOKIE_SECURE") == "True",
        samesite="None" if os.getenv("JWT_COOKIE_SECURE") == "True" else "Lax",
        path="/",
    )
    csrf_token = get_csrf_token(access_token)
    response.set_cookie(
        "csrf_access_token",
        csrf_token,
        httponly=False,
        secure=os.getenv("JWT_COOKIE_SECURE") == "True",
        samesite="None" if os.getenv("JWT_COOKIE_SECURE") == "True" else "Lax",
        path="/",
    )


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


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json or {}

    errors = validate_user(data, is_registering=True)
    if errors:
        return jsonify({"errors": errors}), 400

    firstName = str(data.get("firstName", "")).strip()
    lastName = str(data.get("lastName", "")).strip()
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", "")).strip()

    user_id = create_user(firstName, lastName, email, password)

    if user_id == "EXISTS":
        return jsonify(
            {"errors": {"general": "Could not register. Try again or try and sign in."}}
        ), 400

    token = create_access_token(
        identity=str(user_id), expires_delta=timedelta(hours=24)
    )

    response = jsonify(
        {
            "message": "User registered and logged in successfully.",
            "user": {
                "id": user_id,
                "email": email,
                "firstName": firstName,
                "lastName": lastName,
            },
        }
    )
    refresh_token = create_session(user_id)
    set_refresh_cookies(response, refresh_token)
    set_access_cookies(response, token)

    return response, 201


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}

    errors = validate_user(data)
    if errors:
        return jsonify({"errors": errors}), 400

    email = str(data.get("email", "")).strip()
    password = str(data.get("password", "")).strip()

    user = login_user(email, password)

    if not user:
        return jsonify({"errors": {"general": "Invalid credentials."}}), 400

    access_token = create_access_token(
        identity=str(user["id"]), expires_delta=timedelta(hours=24)
    )

    response = jsonify(
        {
            "message": "login successful.",
            "user": format_json_response(user),
        }
    )

    refresh_token = create_session(user["id"])
    set_refresh_cookies(response, refresh_token)
    set_access_cookies(response, access_token)

    return response


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        delete_refresh_token(refresh_token)
    response = jsonify({"message": "logout successful."})
    unset_jwt_cookies(response)
    response.set_cookie("refresh_token", "", expires=0)
    return response


@auth_bp.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_me():
    current_user_id = get_jwt_identity()
    user = get_user(current_user_id)
    if user:
        return jsonify(
            {"message": "Logged in.", "user": format_json_response(user)}
        ), 200
    return jsonify({"message": "An error occured.", "user": None}), 400


@auth_bp.route("/api/auth/request-password-reset", methods=["POST"])
def request_password_reset():
    data = request.json or {}
    email = data.get("email")

    if not email:
        return jsonify({"errors": {"email": "Email is required"}}), 400
    user = get_user(email=email)

    if user:
        token = create_reset_token(user["id"])
        reset_link = f"{os.getenv('FRONTEND_URL')}/reset-password?token={token}"

        ms = MailerSendClient(os.getenv("MAIL_SEND_API_KEY"))
        html_content = get_password_reset_html(reset_link)

        email_payload = (
            EmailBuilder()
            .from_email(os.getenv("MAIL_SEND_EMAIL"), "Task Manager Support")
            .to_many([{"email": email, "name": user["first_name"]}])
            .subject("Reset your password")
            .html(html_content)
            .build()
        )

        ms.emails.send(email_payload)

    return jsonify(
        {"message": "If an account exists, a reset link has been sent."}
    ), 200


@auth_bp.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.json
    token = data.get("token")
    new_password = data.get("password")

    if not token or not new_password:
        return jsonify({"message": "Invalid request"}), 400

    error = validate_password(new_password)

    if error:
        return jsonify({"errors": {"password": error}}), 400

    user_id = verify_reset_token(token)
    if not user_id:
        return jsonify({"message": "Invalid or expired reset link"}), 400

    success = update_password_and_clear_token(user_id, token, new_password)

    if not success:
        return jsonify({"message": "Could not update password"}), 500

    return jsonify({"message": "Password updated successfully"}), 200


@auth_bp.route("/api/auth/refresh", methods=["POST"])
def refresh():
    refresh_token = request.cookies.get("refresh_token")

    user = validate_refresh_token(refresh_token)

    if not user:
        return jsonify({"message": "Unauthorized"}), 401

    token = create_access_token(
        identity=str(user["id"]), expires_delta=timedelta(hours=24)
    )

    new_refresh_token = rotate_refresh_token(refresh_token, user["id"])

    response = jsonify(
        {
            "message": "User registered and logged in successfully.",
            "user": format_json_response(user),
        }
    )
    set_refresh_cookies(response, new_refresh_token)

    set_access_cookies(response, token)

    return response
