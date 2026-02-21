# 1. Use a lightweight Python image
FROM python:3.11-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Install system dependencies required for MySQL
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of your Flask code
COPY . .

# 6. Expose the port Flask runs on
EXPOSE 8080

# 7. Start the app using Gunicorn (production-grade server)
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "app:app"]