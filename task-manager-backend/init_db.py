import mysql.connector
import os


def initialise_database():
    conn = None
    try:
        db_name = os.getenv("DB_NAME", "task_db")
        ca_path = os.path.join(os.getcwd(), "ca.pem")

        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            port=int(os.getenv("DB_PORT", 3306)),
            ssl_ca=ca_path,
            ssl_verify_cert=True,
            connection_timeout=30,
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
            password_hash VARCHAR(255) NOT NULL
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

        cursor.execute(
            "ALTER TABLE tasks ADD FULLTEXT INDEX idx_tasks_search (title, description);"
        )

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

        cursor.execute("UPDATE tasks SET series_id = id WHERE series_id IS NULL;")
        conn.commit()

    except Exception as e:
        print(f"Database error: {e}")
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()


if __name__ == "__main__":
    initialise_database()
