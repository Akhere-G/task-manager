# --- Stage 1: Build ---
FROM node:20-alpine as build
WORKDIR /app

# Accept the API URL as a build argument
ARG _VITE_API_URL
ENV VITE_API_URL=$_VITE_API_URL
ARG _VITE_POSTHOG_KEY
ENV VITE_POSTHOG_KEY=$_VITE_POSTHOG_KEY
ARG _VITE_POSTHOG_HOST
ENV VITE_POSTHOG_HOST=$_VITE_POSTHOG_HOST

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Stage 2: Production ---
FROM nginx:stable-alpine

# Copy the static files from the build stage to Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy a custom Nginx config to handle React Router refreshes
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]