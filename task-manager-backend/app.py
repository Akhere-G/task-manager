import os
from flask import Flask
from flask_cors import CORS
from routes.task_routes import task_bp
from routes.stats_routes import stats_bp
from routes.mail_routes import mail_bp
from routes.auth_routes import auth_bp
from dotenv import load_dotenv
from extensions import mail
from flask_jwt_extended import JWTManager

load_dotenv()

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY") 
jwt = JWTManager(app)

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
CORS(app, resources={
    r"/*": {
        "origins": [frontend_url, "http://localhost:5173"],
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
# Email Configuration
app.config['MAIL_SERVER'] = '74.125.140.108'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USE_SSL'] = False
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_USERNAME')
mail.init_app(app)

app.register_blueprint(task_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(mail_bp)
app.register_blueprint(auth_bp)

@app.route('/health')
def health_check():
    return {"status": "healthy"}, 200

if __name__ == "__main__":
    app.run(
        host=os.getenv('FLASK_RUN_HOST', '127.0.0.1'),
        port=int(os.getenv('FLASK_RUN_PORT', 5000)),
        debug=True)