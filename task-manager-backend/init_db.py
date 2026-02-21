import mysql.connector
import os

def initialise_database():
    try:
        # Connect using the variables Railway provides
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME'), # Connect directly to the assigned DB
            port=os.getenv('DB_PORT', 3306)
        )
        cursor = conn.cursor()

        with open('schema.sql', 'r') as f:
            sql_script = f.read()

        # Execute as a single multi-statement if using C-extension, 
        # or handle the script properly.
        print("Initialising database...")
        # We use 'multi=True' to handle the Trigger and multiple statements
        for result in cursor.execute(sql_script, multi=True):
            pass

        conn.commit()
        print("Success: Database tables and triggers created.")
    
    except mysql.connector.Error as err:
        print(f"Database setup note: {err}") # Often fails if tables already exist, which is fine

    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

if __name__ == "__main__":
    initialise_database()