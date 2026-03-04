# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install Python for native module compilation (pdfjs-dist needs it)
RUN apk add --no-cache python3

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

# Create storage directories
RUN mkdir -p /app/storage/books /app/storage/thumbnails

# Set Python path to include backend
ENV PYTHONPATH=/app/backend
ENV PORT=8000

# Start the application using PORT env var (Railway sets this dynamically)
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
