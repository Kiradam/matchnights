#!/bin/sh
set -e

echo "Backing up database before migration..."
if [ -f "${DB_FILE:-wc2026.db}" ]; then
    cp "${DB_FILE:-wc2026.db}" "${DB_FILE:-wc2026.db}.pre-migration-$(date +%Y%m%d%H%M%S).bak"
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
