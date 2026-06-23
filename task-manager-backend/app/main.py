import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

from app.routes.task_routes import task_bp
from app.routes.auth_routes import auth_bp
from app.routes.stats_routes import stats_bp
from app.routes.ai_routes import ai_bp
from app.routes.mail_routes import mail_bp
from app.routes.notifications import notification_bp

from app.database import db
from sqlalchemy import select, text

load_dotenv()

jwt = JWTManager()


def create_app():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_folder_path = os.path.join(base_dir, "static")

    app = Flask(__name__, static_folder=static_folder_path, static_url_path="")

    db_user = os.getenv("DB_USER", "root")
    db_password = os.getenv("DB_PASSWORD", "Super555")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "3306")
    db_name = os.getenv("DB_NAME", "task_db")

    database_url = (
        f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    )

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token_cookie"
    app.config["JWT_REFRESH_COOKIE_NAME"] = "refresh_token"
    app.config["JWT_REFRESH_COOKIE_PATH"] = "/"
    app.config["JWT_ACCESS_COOKIE_PATH"] = "/"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["JWT_COOKIE_DOMAIN"] = None
    app.config["JWT_COOKIE_SECURE"] = os.getenv("JWT_COOKIE_SECURE") == "True"

    if app.config["JWT_COOKIE_SECURE"]:
        app.config["JWT_COOKIE_SAMESITE"] = "None"
    else:
        app.config["JWT_COOKIE_SAMESITE"] = "Lax"

    jwt.init_app(app)
    db.init_app(app)

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [frontend_url, "http://localhost:5173"],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
                "expose_headers": ["Set-Cookie"],
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
        def health_check():
            return {"status": "healthy"}, 200

        @app.route("/api/keep-alive")
        def keep_alive():
            db.session.execute(select(text("SELECT 1")))
            return "DB Poked", 200

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve(path: str):
            static_folder = app.static_folder or ""
            if path != "" and os.path.exists(os.path.join(static_folder, path)):
                return send_from_directory(static_folder, path)
            return send_from_directory(static_folder, "index.html")

        @app.errorhandler(404)
        def not_found(e):
            static_folder = app.static_folder or ""
            return send_from_directory(static_folder, "index.html")

        @app.errorhandler(500)
        def handle_500_error(e):
            original = getattr(e, "original_exception", e)
            import traceback

            print("CRITICAL ERROR")
            print(traceback.format_exc())
            return jsonify(
                {"error": "Internal Server Error", "message": str(original)}
            ), 500

        @app.errorhandler(Exception)
        def handle_exception(e):
            import traceback

            print("CRITICAL ERROR")
            print(traceback.format_exc())
            return jsonify({"error": "Uncaught Exception", "message": str(e)}), 500

        return app


if __name__ == "__main__":
    flask_app = create_app()
    flask_app.run(
        host=os.getenv("FLASK_RUN_HOST", "localhost"),
        port=int(os.getenv("FLASK_RUN_PORT", 8080)),
        debug=True,
    )
