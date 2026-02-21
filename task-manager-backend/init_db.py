import mysql.connector
import os

def initialise_database():
    conn = None
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME'),
            port=os.getenv('DB_PORT', 3306),
            use_pure=True 
        )
        cursor = conn.cursor()

        with open('schema.sql', 'r') as f:
            sql_script = f.read()

        results = cursor.execute(sql_script, multi=True)
        for result in results:
            pass

        conn.commit()
    except mysql.connector.Error as err:
        pass
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

if __name__ == "__main__":
    initialise_database()