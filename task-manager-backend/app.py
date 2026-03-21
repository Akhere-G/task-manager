import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from routes.task_routes import task_bp
from routes.stats_routes import stats_bp
from routes.mail_routes import mail_bp
from routes.auth_routes import auth_bp
from routes.ai_routes import ai_bp
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager
from db import get_db_connection

load_dotenv()

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

app = Flask(__name__, static_folder="static", static_url_path="")

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token_cookie"
app.config["JWT_REFRESH_COOKIE_NAME"] = "refresh_token"
app.config["JWT_REFRESH_COOKIE_PATH"] = "/"
app.config["JWT_COOKIE_SECURE"] = os.getenv("JWT_COOKIE_SECURE") == "True"
app.config["JWT_ACCESS_COOKIE_PATH"] = "/"

app.config["JWT_COOKIE_CSRF_PROTECT"] = False

app.config["JWT_COOKIE_DOMAIN"] = None

if app.config["JWT_COOKIE_SECURE"]:
    app.config["JWT_COOKIE_SAMESITE"] = "None"
else:
    app.config["JWT_COOKIE_SAMESITE"] = "Lax"

jwt = JWTManager(app)

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


app.register_blueprint(task_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(mail_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(ai_bp)


@app.route("/health")
def health_check():
    return {"status": "healthy"}, 200


@app.route("/api/keep-alive")
def keep_alive():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT 1")
    cursor.fetchone()
    cursor.close()
    conn.close()
    return "DB Poked", 200


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    path_dir = os.path.abspath("./static")
    if path != "" and os.path.exists(os.path.join(path_dir, path)):
        return send_from_directory(os.path.join(path_dir), path)
    else:
        return send_from_directory(os.path.join(path_dir), "index.html")


@app.errorhandler(404)
def not_found(e):
    return app.send_static_file("index.html")


@app.errorhandler(500)
def handle_500_error(e):
    original = getattr(e, "original_exception", e)
    return jsonify({"error": "Internal Server Error", "message": str(original)}), 500


@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": "Uncaught Exception", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_RUN_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_RUN_PORT", 5000)),
        debug=True,
    )
