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
            repeat_by ENUM ("daily", "weekly", "monthly", "yearly"),
            repeat_until DATE,
            series_id INT,
            user_id INT NOT NULL,
            CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

        fulltext_index = "ALTER TABLE tasks ADD FULLTEXT INDEX idx_tasks_search (title, description);"

        trigger = """
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
        recurring_task_migration = """
        ALTER TABLE tasks
        ADD COLUMN series_id INT;
        ALTER TABLE tasks
        ADD COLUMN repeat_until DATE;
        ALTER TABLE tasks
        ADD COLUMN repeat_by ENUM ("daily", "weekly", "monthly","yearly");
        ALTER TABLE tasks
        ADD COLUMN is_repeating BOOLEAN DEFAULT FALSE;
        """

        series_id_migration = """
        UPDATE tasks 
        SET series_id = id 
        WHERE series_id IS NULL;     
        """

        cursor.execute(users_table)
        conn.commit()
        cursor.execute(tasks_table)
        conn.commit()
        cursor.execute(daily_briefs_table)
        conn.commit()
        cursor.execute(password_resets)
        conn.commit()
        cursor.execute(refresh_tokens_table)
        conn.commit()

        try:
            cursor.execute(fulltext_index)
            conn.commit()
        except Exception as err:
            print(f"Error: Could not complete full text {err}")
            pass

        try:
            cursor.execute(recurring_task_migration)
            conn.commit()
        except Exception as err:
            print(f"Error: Could not complete recurring migration {err}")
            pass

        try:
            cursor.execute(series_id_migration)
            conn.commit()
        except Exception as err:
            print(f"Error: Could not complete series id migration {err}")
            pass

        try:
            cursor.execute(trigger)
            conn.commit()
        except Exception as err:
            print(
                f"Error: Could not complete ensure completion time stamp trigger migration {err}"
            )
            pass

    except Exception as e:
        print(f"Database error: {e}")
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()


if __name__ == "__main__":
    initialise_database()
