import os
from flask import Flask, request, make_response
from flask_cors import CORS
from routes.task_routes import task_bp
from routes.stats_routes import stats_bp
from routes.mail_routes import mail_bp
from routes.auth_routes import auth_bp
from routes.ai_routes import ai_bp
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager

load_dotenv()

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

app = Flask(__name__)

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


@app.before_request
def handle_options_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        origin = request.headers.get("Origin")
        if origin in [frontend_url, "http://localhost:5173"]:
            response.headers.add("Access-Control-Allow-Origin", origin)
            response.headers.add(
                "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
            )
            response.headers.add(
                "Access-Control-Allow-Headers", "Content-Type, Authorization"
            )
            response.headers.add("Access-Control-Allow-Credentials", "true")
        return response


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin in [os.getenv("FRONTEND_URL"), "http://localhost:5173"]:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = (
            "GET, POST, PUT, DELETE, OPTIONS"
        )
        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization, X-Requested-With"
        )

    if request.method == "OPTIONS":
        return response
    return response


@app.route("/health")
def health_check():
    return {"status": "healthy"}, 200


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_RUN_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_RUN_PORT", 5000)),
        debug=True,
    )
