import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def initialise_database():
  try:
    conn = mysql.connector.connect(
      host=os.getenv('DB_HOST', '127.0.0.1'),
      user=os.getenv('DB_USER', 'root'),
      password=os.getenv('DB_PASSWORD')
    )

    cursor = conn.cursor()

    with open('schema.sql', 'r') as f:
      sql_script = f.read()

    commands = sql_script.split(";")

    print("Initialising database...")
    for command in commands:
      if command.strip():
        cursor.execute(command)

    conn.commit()
    print("Success: Database 'task_db' and tables created.")
    
  except mysql.connector.Error as err:
    print(f"Error: {err}")

  finally:
    if 'conn' in locals() and conn.is_connected():
      cursor.close()
      conn.close()

if __name__ == "__main__":
  initialise_database()