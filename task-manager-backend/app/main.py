import logging
import os

from dotenv import load_dotenv
from flask import Flask, Response, abort, request, send_from_directory
from flask.typing import ResponseReturnValue
from flask_compress import Compress
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from sqlalchemy import select, text
from werkzeug.middleware.proxy_fix import ProxyFix

from app.config import APP_REQUIRED, DB_REQUIRED, build_database_url, require_env
from app.database import ENGINE_OPTIONS, db
from app.errors import register_error_handlers
from app.extensions import limiter
from app.headers import register_response_headers
from app.routes.ai_routes import ai_bp
from app.routes.auth_routes import auth_bp
from app.routes.mail_routes import mail_bp
from app.routes.notifications import notification_bp
from app.routes.stats_routes import stats_bp
from app.routes.task_routes import task_bp

load_dotenv()

jwt = JWTManager()


def create_app() -> Flask:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_folder_path = os.path.join(base_dir, "static")

    app = Flask(__name__, static_folder=static_folder_path, static_url_path="")

    require_env(DB_REQUIRED + APP_REQUIRED)

    app.config["SQLALCHEMY_DATABASE_URI"] = build_database_url()
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = ENGINE_OPTIONS
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token_cookie"
    app.config["JWT_REFRESH_COOKIE_NAME"] = "refresh_token"
    app.config["JWT_REFRESH_COOKIE_PATH"] = "/"
    app.config["JWT_ACCESS_COOKIE_PATH"] = "/"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["JWT_COOKIE_DOMAIN"] = None
    app.config["JWT_COOKIE_SECURE"] = os.getenv("JWT_COOKIE_SECURE") != "False"
    app.config["JWT_COOKIE_SAMESITE"] = os.getenv("JWT_COOKIE_SAMESITE") or "Lax"

    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    register_error_handlers(app)
    register_response_headers(app)
    Compress(app)

    @app.before_request
    def require_ajax_header() -> None:
        if (
            request.path.startswith("/api/")
            and request.method in ("POST", "PUT", "PATCH", "DELETE")
            and request.headers.get("X-Requested-With") != "XMLHttpRequest"
        ):
            abort(403, description="Missing required request header.")

    app.wsgi_app = ProxyFix(
        app.wsgi_app,
        x_for=int(os.getenv("TRUSTED_PROXY_HOPS") or 1),
        x_proto=int(os.getenv("TRUSTED_PROXY_HOPS") or 1),
    )

    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        app.logger.warning(
            "REDIS_URL is not set: rate limits are tracked in memory, per process"
        )
    app.config["RATELIMIT_STORAGE_URI"] = redis_url or "memory://"
    app.config["RATELIMIT_SWALLOW_ERRORS"] = True
    app.config["RATELIMIT_IN_MEMORY_FALLBACK_ENABLED"] = True
    app.config.setdefault(
        "RATELIMIT_ENABLED", os.getenv("RATELIMIT_ENABLED", "True") != "False"
    )
    limiter.init_app(app)

    jwt.init_app(app)
    db.init_app(app)

    frontend_url = os.environ["FRONTEND_URL"].rstrip("/")
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [frontend_url, "http://localhost:5173"],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
            }
        },
        supports_credentials=True,
    )

    with app.app_context():
        app.register_blueprint(task_bp)
        app.register_blueprint(auth_bp)
        app.register_blueprint(stats_bp)
        app.register_blueprint(ai_bp)
        app.register_blueprint(mail_bp)
        app.register_blueprint(notification_bp)

        @app.route("/health")
        @limiter.exempt
        def health_check() -> ResponseReturnValue:
            return {"status": "healthy"}, 200

        @app.route("/api/keep-alive")
        @limiter.exempt
        def keep_alive() -> ResponseReturnValue:
            db.session.execute(select(text("SELECT 1")))
            return "DB Poked", 200

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        @limiter.exempt
        def serve(path: str) -> Response:
            static_folder = app.static_folder or ""
            if path == "api" or path.startswith("api/"):
                abort(404)
            if path != "" and os.path.exists(os.path.join(static_folder, path)):
                return send_from_directory(static_folder, path)
            return send_from_directory(static_folder, "index.html")

        return app


if __name__ == "__main__":
    flask_app = create_app()
    flask_app.run(
        host=os.getenv("FLASK_RUN_HOST", "localhost"),
        port=int(os.getenv("FLASK_RUN_PORT", 8080)),
        debug=True,
    )
