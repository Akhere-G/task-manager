# 1. Frontend Build Stage
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY task-manager-frontend/package*.json ./
RUN npm ci
COPY task-manager-frontend/ .
ARG _VITE_API_URL
ENV VITE_API_URL=$_VITE_API_URL
ARG _VITE_POSTHOG_PROJECT_TOKEN
ENV VITE_POSTHOG_PROJECT_TOKEN=$_VITE_POSTHOG_PROJECT_TOKEN
ARG _VITE_POSTHOG_HOST
ENV VITE_POSTHOG_HOST=$_VITE_POSTHOG_HOST
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

# Start script: run migrations (stop on failure), then serve
COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh \
  && useradd --system --no-create-home app \
  && chown -R app /app

USER app

EXPOSE 8080
CMD ["/app/start.sh"]
