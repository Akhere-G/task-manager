import os
import sys

from sqlalchemy import create_engine, text

from app.config import build_database_url
from app.database import build_connect_args


def main():
    engine = create_engine(build_database_url(), connect_args=build_connect_args())
    with engine.connect() as conn:
        cipher = conn.execute(text("SHOW SESSION STATUS LIKE 'Ssl_cipher'")).fetchone()
    value = cipher[1] if cipher else ""
    if not value:
        print("Connection is NOT encrypted.")
        return 1
    if os.getenv("DB_SSL_CA"):
        print(f"Connection is encrypted and the server certificate is verified ({value}).")
        return 0
    print(
        f"Connection is encrypted ({value}) but the server certificate is NOT verified. "
        "Set DB_SSL_CA to the provider's CA file."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
