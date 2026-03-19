# 1. Use an official Python runtime as a parent image
FROM python:3.11-slim

# 2. Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 3. Install system dependencies for MySQL and Build Tools
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 4. Set the working directory in the container
WORKDIR /app

# 5. Copy requirements first to leverage Docker cache
COPY requirements.txt .
COPY ca.pem /app/ca.pem
# 6. Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 7. Copy the rest of the application code
COPY . .

# 8. Create the start script
# This script runs the database initialisation before starting Gunicorn
RUN echo '#!/bin/sh\n\
    python init_db.py\n\
    gunicorn --bind 0.0.0.0:8080 app:app' > /app/start.sh

# 9. Make the start script executable
RUN chmod +x /app/start.sh

# 10. Expose the port Railway expects
EXPOSE 8080

# 11. Run the start script
CMD ["/app/start.sh"]