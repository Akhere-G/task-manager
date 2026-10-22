from flask import jsonify, request, send_from_directory
from flask_limiter.errors import RateLimitExceeded
from werkzeug.exceptions import HTTPException, NotFound


def register_error_handlers(app):
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
