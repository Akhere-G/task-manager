import mysql.connector
import os

def initialise_database():
    conn = None
    try:
        db_name = os.getenv('DB_NAME', 'task_db')
        
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=int(os.getenv('DB_PORT', 3306))
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
            description TEXT NOT NULL,
            category VARCHAR(50) DEFAULT 'General',
            is_completed BOOLEAN DEFAULT FALSE,
            due_date DATE NOT NULL,
            estimated_time INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            user_id INT NOT NULL,
            CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

        fulltext_index = "CREATE FULLTEXT INDEX IF NOT EXISTS idx_tasks_search ON tasks(title, description);"

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
        
        try:
            cursor.execute(fulltext_index)
        except:
            pass
            
        try:
            cursor.execute(trigger)
        except:
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