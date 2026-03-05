import mysql.connector
import os


def initialise_database():
    conn = None
    try:
        db_name = os.getenv("DB_NAME", "task_db")

        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            port=int(os.getenv("DB_PORT", 3306)),
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
            user_id INT NOT NULL,
            CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

        fulltext_index = "CREATE FULLTEXT INDEX IF NOT EXISTS idx_tasks_search ON tasks(title, description);"

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

        cursor.execute(users_table)
        cursor.execute(tasks_table)
        cursor.execute(daily_briefs_table)

        cursor.execute("SHOW COLUMNS FROM tasks")
        columns = [col["Field"] for col in cursor.fetchall()]

        if "due_date" in columns:
            print("Detected old schema. Migrating data to start_at and end_at...")

            # Ensure new columns exist (in case they weren't added by the CREATE TABLE IF NOT EXISTS)
            if "start_at" not in columns:
                cursor.execute(
                    "ALTER TABLE tasks ADD COLUMN start_at TIMESTAMP NULL AFTER description"
                )
            if "end_at" not in columns:
                cursor.execute(
                    "ALTER TABLE tasks ADD COLUMN end_at TIMESTAMP NULL AFTER start_at"
                )

            # Transfer data: end_at = due_date, start_at = due_date - estimated_time (default 30m)
            migration_query = """
            UPDATE tasks 
            SET 
                end_at = due_date,
                start_at = DATE_SUB(due_date, INTERVAL COALESCE(estimated_time, 30) MINUTE)
            WHERE end_at IS NULL;
            """
            cursor.execute(migration_query)

            # Now set them to NOT NULL and cleanup old columns
            cursor.execute(
                "ALTER TABLE tasks MODIFY COLUMN start_at TIMESTAMP NOT NULL"
            )
            cursor.execute("ALTER TABLE tasks MODIFY COLUMN end_at TIMESTAMP NOT NULL")
            cursor.execute("ALTER TABLE tasks DROP COLUMN due_date")
            if "estimated_time" in columns:
                cursor.execute("ALTER TABLE tasks DROP COLUMN estimated_time")
            print("Migration successful.")

        else:
            # If it's a fresh install, just ensure they are NOT NULL
            cursor.execute(
                "ALTER TABLE tasks MODIFY COLUMN start_at TIMESTAMP NOT NULL"
            )
            cursor.execute("ALTER TABLE tasks MODIFY COLUMN end_at TIMESTAMP NOT NULL")
        try:
            cursor.execute(fulltext_index)
        except Exception:
            pass

        try:
            cursor.execute(trigger)
        except Exception:
            pass

        conn.commit()
    except Exception as e:
        print(f"Database error: {e}")
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()


if __name__ == "__main__":
    initialise_database()
