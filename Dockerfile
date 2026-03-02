# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Copy scripts needed for postinstall
COPY scripts ./scripts

# Install dependencies
RUN npm ci

# Copy frontend source
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Python backend + serve frontend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements first for better caching
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application code
COPY backend ./backend

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/dist ./static

# Copy existing books to temp location for one-time migration
COPY backend/storage ./initial_storage

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create storage directories
RUN mkdir -p /app/storage/books /app/storage/thumbnails

# Expose port
EXPOSE 8000

# Set Python path to include backend
ENV PYTHONPATH=/app/backend

# Run entrypoint script which starts the app
ENTRYPOINT ["./docker-entrypoint.sh"]
