# 1. Frontend Build Stage
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY task-manager-frontend/package*.json ./
RUN npm install
COPY task-manager-frontend/ .
ARG _VITE_API_URL
ENV VITE_API_URL=$_VITE_API_URL
RUN npm run build

# 2. Final Runtime Stage
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Set PYTHONPATH so 'app' is recognized as a package root
ENV PYTHONPATH=/app

RUN apt-get update && apt-get install -y \
  default-libmysqlclient-dev \
  build-essential \
  pkg-config \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend requirements and install
COPY task-manager-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY task-manager-backend/ .

# Copy built frontend from stage 1
COPY --from=frontend-builder /build/dist /app/static

# Create the start script. init_db.py lives at the backend root (/app/init_db.py),
# so it is run as a script; gunicorn imports 'app' as a package via PYTHONPATH.
RUN echo '#!/bin/sh\n\
  python init_db.py\n\
  gunicorn --bind 0.0.0.0:8080 "app.main:create_app()"' > /app/start.sh

RUN chmod +x /app/start.sh

EXPOSE 8080
CMD ["/app/start.sh"]