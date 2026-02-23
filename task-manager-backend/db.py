import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

db_config = {
    "host": os.getenv('DB_HOST', '127.0.0.1'),
    "user": os.getenv('DB_USER', 'root'),
    "password": os.getenv('DB_PASSWORD'),
    "database": os.getenv('DB_NAME', 'task_db'),
    "port": int(os.getenv('DB_PORT', 3306))
}

try:
    connection_pool = mysql.connector.pooling.MySQLConnectionPool(
        pool_name="task_pool",
        pool_size=10,
        pool_reset_session=True,
        **db_config
    )
except mysql.connector.Error:
    connection_pool = None

def get_db_connection():
    if connection_pool:
        try:
            return connection_pool.get_connection()
        except mysql.connector.Error as err:
            raise err
    else:
        return mysql.connector.connect(**db_config)