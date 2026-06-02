#!/bin/sh
set -e

DB="${DB_FILE:-wc2026.db}"
BACKUP_FILE=""

echo "Backing up database before migration..."
if [ -f "$DB" ]; then
    BACKUP_FILE="${DB}.pre-migration-$(date +%Y%m%d%H%M%S).bak"
    cp "$DB" "$BACKUP_FILE"
    echo "Backup created: $BACKUP_FILE"
fi

echo "Running database migrations..."
if ! alembic upgrade head; then
    echo "ERROR: Database migration failed." >&2
    if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
        echo "Restoring database from backup: $BACKUP_FILE" >&2
        cp "$BACKUP_FILE" "$DB"
        echo "Database restored to pre-migration state." >&2
    fi
    exit 1
fi

echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
