import pymysql
import os
from dotenv import load_dotenv

from app.config import DB_REQUIRED, require_env, ssl_ca_path

load_dotenv()


def column_exists(cursor, db_name, table, column):
    cursor.execute(
        """
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s
        """,
        (db_name, table, column),
    )
    return cursor.fetchone()[0] > 0


def index_exists(cursor, db_name, table, index):
    cursor.execute(
        """
        SELECT COUNT(*) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND INDEX_NAME = %s
        """,
        (db_name, table, index),
    )
    return cursor.fetchone()[0] > 0


def run_step(label, step):
    try:
        step()
        print(f"Migration step ok: {label}")
    except Exception as e:
        print(f"Migration step FAILED: {label}: {e}")


def initialise_database():
    require_env(DB_REQUIRED)
    conn = None
    cursor = None
    try:
        db_name = os.environ["DB_NAME"]
        conn = pymysql.connect(
            host=os.environ["DB_HOST"],
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
            port=int(os.getenv("DB_PORT", 3306)),
            database=db_name,
            connect_timeout=30,
            ssl_ca=ssl_ca_path(),
            cursorclass=pymysql.cursors.Cursor,
        )

        cursor = conn.cursor()

        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        cursor.execute(f"USE {db_name}")

        users_table = """
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            first_name VARCHAR(50) NOT NULL,
            last_name VARCHAR(50) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            is_demo BOOLEAN NOT NULL DEFAULT FALSE
        );
        """

        tasks_table = """
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            category VARCHAR(50) DEFAULT 'General',
            is_completed BOOLEAN DEFAULT FALSE,
            start_at TIMESTAMP NOT NULL,
            end_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            is_repeating BOOLEAN DEFAULT FALSE,
            repeat_by ENUM ('daily', 'weekly', 'monthly', 'yearly'),
            repeat_until DATE,
            series_id INT,
            user_id INT NOT NULL,
            CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

        daily_briefs_table = """
        CREATE TABLE IF NOT EXISTS daily_briefs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            brief_text TEXT NOT NULL,
            generated_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_day (user_id, generated_date),
            CONSTRAINT fk_brief_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

        password_resets = """
        CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(255) NOT NULL,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

        refresh_tokens_table = """
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(255) NOT NULL,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

        notifications_table = """
        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

        notification_subscriptions_table = """
        CREATE TABLE IF NOT EXISTS notification_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            endpoint VARCHAR(500) UNIQUE NOT NULL,
            p256dh VARCHAR(255) NOT NULL,
            auth VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

        # Execute table creation
        tables = [
            users_table,
            tasks_table,
            daily_briefs_table,
            password_resets,
            refresh_tokens_table,
            notifications_table,
            notification_subscriptions_table,
        ]
        for sql in tables:
            cursor.execute(sql)
            conn.commit()

        def add_is_demo_column():
            if not column_exists(cursor, db_name, "users", "is_demo"):
                cursor.execute(
                    "ALTER TABLE users ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE"
                )
                conn.commit()

        def add_fulltext_index():
            if not index_exists(cursor, db_name, "tasks", "idx_tasks_search"):
                cursor.execute(
                    "ALTER TABLE tasks ADD FULLTEXT INDEX idx_tasks_search (title, description);"
                )
                conn.commit()

        def create_completion_trigger():
            cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS tr_ensure_completion_timestamp
            BEFORE UPDATE ON tasks
            FOR EACH ROW
            BEGIN
                IF NEW.is_completed = 1 AND NEW.completed_at IS NULL THEN
                    SET NEW.completed_at = NOW();
                ELSEIF NEW.is_completed = 0 THEN
                    SET NEW.completed_at = NULL;
                END IF;
            END;
            """)
            conn.commit()

        def backfill_series_ids():
            cursor.execute("UPDATE tasks SET series_id = id WHERE series_id IS NULL;")
            conn.commit()

        def add_token_hash_columns():
            for table in ("refresh_tokens", "password_resets"):
                if not column_exists(cursor, db_name, table, "token_hash"):
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN token_hash CHAR(64) NULL")
                    conn.commit()

        def backfill_token_hashes():
            for table in ("refresh_tokens", "password_resets"):
                cursor.execute(
                    f"UPDATE {table} SET token_hash = SHA2(token, 256) "
                    "WHERE token_hash IS NULL AND token IS NOT NULL"
                )
                conn.commit()

        def relax_plaintext_token_columns():
            for table in ("refresh_tokens", "password_resets"):
                cursor.execute(f"ALTER TABLE {table} MODIFY token VARCHAR(255) NULL")
                conn.commit()

        def add_session_indexes():
            if not index_exists(cursor, db_name, "refresh_tokens", "uq_refresh_tokens_token_hash"):
                cursor.execute(
                    "SELECT COUNT(*) FROM (SELECT token_hash FROM refresh_tokens "
                    "WHERE token_hash IS NOT NULL GROUP BY token_hash HAVING COUNT(*) > 1) d"
                )
                if cursor.fetchone()[0]:
                    raise RuntimeError("duplicate refresh token hashes found")
                cursor.execute(
                    "ALTER TABLE refresh_tokens ADD UNIQUE INDEX uq_refresh_tokens_token_hash (token_hash)"
                )
                conn.commit()
            if not index_exists(cursor, db_name, "refresh_tokens", "idx_refresh_tokens_expires"):
                cursor.execute(
                    "ALTER TABLE refresh_tokens ADD INDEX idx_refresh_tokens_expires (expires_at)"
                )
                conn.commit()
            if not index_exists(cursor, db_name, "password_resets", "idx_password_resets_token_hash"):
                cursor.execute(
                    "ALTER TABLE password_resets ADD INDEX idx_password_resets_token_hash (token_hash)"
                )
                conn.commit()
            if not index_exists(cursor, db_name, "password_resets", "idx_password_resets_expires"):
                cursor.execute(
                    "ALTER TABLE password_resets ADD INDEX idx_password_resets_expires (expires_at)"
                )
                conn.commit()

        def add_refresh_tokens_replaced_at():
            if not column_exists(cursor, db_name, "refresh_tokens", "replaced_at"):
                cursor.execute("ALTER TABLE refresh_tokens ADD COLUMN replaced_at DATETIME NULL")
                conn.commit()

        def add_tasks_reminded_for_start_at():
            if not column_exists(cursor, db_name, "tasks", "reminded_for_start_at"):
                cursor.execute("ALTER TABLE tasks ADD COLUMN reminded_for_start_at DATETIME NULL")
                conn.commit()

        run_step("users.is_demo column", add_is_demo_column)
        run_step("tasks fulltext index", add_fulltext_index)
        run_step("completion trigger", create_completion_trigger)
        run_step("series_id backfill", backfill_series_ids)
        run_step("token_hash columns", add_token_hash_columns)
        run_step("token_hash backfill", backfill_token_hashes)
        run_step("plaintext token columns nullable", relax_plaintext_token_columns)
        run_step("session table indexes", add_session_indexes)
        run_step("refresh_tokens.replaced_at column", add_refresh_tokens_replaced_at)
        run_step("tasks.reminded_for_start_at column", add_tasks_reminded_for_start_at)

    except Exception as e:
        print(f"Database error: {e}")
    finally:
        if conn and cursor:
            cursor.close()
            conn.close()


if __name__ == "__main__":
    initialise_database()
