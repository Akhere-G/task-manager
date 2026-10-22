from flask import jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException, NotFound


def register_error_handlers(app):
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
