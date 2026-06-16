# 1. Use an official Python runtime
FROM python:3.11-slim

# 2. Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
# PYTHONPATH ensures Python finds modules inside /app/app
ENV PYTHONPATH=/app

# 3. Install system dependencies
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 4. Set the working directory
WORKDIR /app

# 5. Copy requirements and CA certificate
COPY requirements.txt .
COPY ca.pem /app/ca.pem

# 6. Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 7. Copy the rest of the application code
COPY . .

# 8. Create the start script
RUN echo '#!/bin/sh\n\
    python app/init_db.py\n\
    gunicorn --bind 0.0.0.0:8080 app.main:app' > /app/start.sh

# 9. Make the start script executable
RUN chmod +x /app/start.sh

# 10. Expose the port
EXPOSE 8080

# 11. Run the start script
CMD ["/app/start.sh"]