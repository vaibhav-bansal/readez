#!/bin/bash
set -e

# One-time migration: copy initial books to mounted volume if storage is empty
if [ -z "$(ls -A /app/storage/books 2>/dev/null)" ]; then
    echo "First run: migrating initial books to volume..."
    if [ -d "/app/initial_storage/books" ] && [ "$(ls -A /app/initial_storage/books 2>/dev/null)" ]; then
        cp -r /app/initial_storage/books/* /app/storage/books/ 2>/dev/null || true
        echo "Books migration complete."
    fi
    if [ -d "/app/initial_storage/thumbnails" ] && [ "$(ls -A /app/initial_storage/thumbnails 2>/dev/null)" ]; then
        cp -r /app/initial_storage/thumbnails/* /app/storage/thumbnails/ 2>/dev/null || true
        echo "Thumbnails migration complete."
    fi
else
    echo "Storage volume already has data, skipping migration."
fi

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
