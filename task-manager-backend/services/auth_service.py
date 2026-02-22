from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db_connection
import mysql.connector

def create_user(first_name, last_name, email, password):
    try:
        hashed_password = generate_password_hash(password)
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
    
        query = """
            INSERT INTO users (first_name, last_name, email, password_hash)
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(query, (first_name, last_name, email, hashed_password))
        conn.commit()
        return cursor.lastrowid
    except mysql.connector.Error as err:
        if err.errno == 1062:  # Duplicate email
            return "EXISTS"
        raise err
    finally:
        cursor.close()
        conn.close()

def login_user(email, password):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
    
        query = "SELECT id, first_name, last_name, email, password_hash FROM users WHERE email = %s"
        cursor.execute(query, (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user['password_hash'], password):
            return user
        return None
    except Exception as err:
        raise err
    finally:    
        cursor.close()
        conn.close()