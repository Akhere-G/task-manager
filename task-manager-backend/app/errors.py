from flask import jsonify, request, send_from_directory
from flask_limiter.errors import RateLimitExceeded
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException, NotFound

from app.exceptions import AppError
from app.utils.formatters import format_json_response


def flatten_validation_errors(messages):
    """Marshmallow's `{field: [msg, ...]}` as `{field: msg}`.

    Errors from a many=True load are keyed by index and become a list with one
    entry per failing item, so the frontend can match them to its rows.
    """
    if not isinstance(messages, dict):
        return {"general": messages[0]}
    if messages and all(isinstance(key, int) for key in messages):
        return [
            flatten_validation_errors(messages.get(index, {}))
            for index in range(max(messages) + 1)
        ]

    flat = {}
    for field, value in messages.items():
        key = "general" if field == "_schema" else field
        flat[key] = (
            value[0] if isinstance(value, list) else flatten_validation_errors(value)
        )
    return flat


def register_error_handlers(app):
    @app.errorhandler(AppError)
    def handle_app_error(error):
        return jsonify(format_json_response(error.to_dict())), error.status_code

    @app.errorhandler(ValidationError)
    def handle_validation_error(error):
        return jsonify({"errors": flatten_validation_errors(error.messages)}), 400

    @app.errorhandler(RateLimitExceeded)
    def handle_rate_limit(error):
        response = jsonify({"error": "Too many requests. Please try again later."})
        response.status_code = 429
        try:
            retry_after = int(error.limit.limit.get_expiry())
            response.headers["Retry-After"] = str(retry_after)
        except Exception:
            pass
        return response

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        if request.path.startswith("/api/"):
            return jsonify({"error": error.description}), error.code

        if error.code == 404 and request.method in ("GET", "HEAD"):
            try:
                return send_from_directory(app.static_folder or "", "index.html")
            except NotFound:
                return error

        return error

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error):
        app.logger.exception("Unhandled error on %s %s", request.method, request.path)
        return jsonify({"error": "Internal server error"}), 500
