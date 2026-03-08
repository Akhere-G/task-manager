from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db_connection
import mysql.connector
import secrets
from datetime import datetime, timedelta


def create_user(first_name, last_name, email, password):
    conn = None
    cursor = None
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
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def login_user(email, password):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = "SELECT id, first_name, last_name, email, password_hash FROM users WHERE email = %s"
        cursor.execute(query, (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user["password_hash"], password):
            return user
        return None
    except Exception as err:
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def get_user(id=None, email=None):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if id:
            query = "SELECT id, first_name, last_name, email FROM users WHERE id = %s"
            cursor.execute(query, (id,))
        elif email:
            query = (
                "SELECT id, first_name, last_name, email FROM users WHERE email = %s"
            )
            cursor.execute(query, (email,))
        else:
            return None

        user = cursor.fetchone()

        if user:
            return user
        return None
    except Exception as err:
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def create_reset_token(user_id):
    conn = None
    cursor = None
    try:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(minutes=15)

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM password_resets WHERE user_id = %s", (user_id,))
        cursor.execute(
            "INSERT INTO password_resets (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (user_id, token, expires_at),
        )
        conn.commit()
        return token
    except Exception as err:
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def verify_reset_token(token):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT user_id FROM password_resets WHERE token = %s AND expires_at > %s",
            (token, datetime.now()),
        )
        result = cursor.fetchone()
        return result["user_id"] if result else None
    except Exception as err:
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def update_password_and_clear_token(user_id, token, new_password):
    conn = None
    cursor = None
    try:
        hashed_password = generate_password_hash(new_password)
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hashed_password, user_id),
        )
        cursor.execute("DELETE FROM password_resets WHERE token = %s", (token,))

        conn.commit()
        return True
    except Exception as err:
        if conn:
            conn.rollback()
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def validate_refresh_token(refresh_token):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT u.id, u.first_name, u.last_name, u.email 
            FROM users u
            JOIN refresh_tokens rt ON u.id = rt.user_id
            WHERE rt.token = %s AND rt.expires_at > %s
        """
        cursor.execute(query, (refresh_token, datetime.now()))
        user = cursor.fetchone()

        return user
    except mysql.connector.Error:
        return None
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def delete_refresh_token(refresh_token):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM refresh_tokens WHERE token = %s", (refresh_token,))
        conn.commit()
    except mysql.connector.Error:
        return None
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def create_session(user_id):
    conn = None
    cursor = None
    try:
        token = secrets.token_urlsafe(64)
        expires_at = datetime.now() + timedelta(days=7)

        conn = get_db_connection()
        cursor = conn.cursor()

        query = "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)"
        cursor.execute(query, (user_id, token, expires_at))
        conn.commit()

        return token
    except mysql.connector.Error as err:
        if conn:
            conn.rollback()
        raise err
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


def rotate_refresh_token(old_token, user_id):
    delete_refresh_token(old_token)

    new_token = create_session(user_id)
    return new_token
