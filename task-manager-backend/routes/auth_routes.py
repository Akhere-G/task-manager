from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from datetime import timedelta
from services.auth_service import create_user, login_user
from utils.validators import validate_user

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json or {}

    errors = validate_user(data, is_registering=True)
    if errors:
        return jsonify({ "errors": errors }), 400
    
    firstName = str(data.get("firstName", "")).strip()
    lastName = str(data.get("lastName", "")).strip()
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", "")).strip()

    user_id = create_user(firstName, lastName, email, password)

    if user_id == "EXISTS":
        return jsonify({ "error": "A user with that email already exists"}), 409
    
    token = create_access_token(identity=str(user_id), expires_delta=timedelta(hours=24))
    return jsonify({ "token": token }), 201

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}

    errors = validate_user(data)
    if errors:
        return jsonify({ "errors": errors }), 400
    
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", "")).strip()

    user = login_user(email, password)

    if not user:
        return jsonify({ "error" : "Email or password is incorrect" }), 400
    
    token = create_access_token(identity=str(user['id']), expires_delta=timedelta(hours=24))
    return jsonify({ "token" : token }), 200