#!/bin/bash

# Configuration
CONTAINER_NAME="portfolio-db"

# Check for argument
if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_backup_file>"
  echo "Example: $0 ./backups/backup_20251228_120000.sql"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/*.sql 2>/dev/null
  exit 1
fi

BACKUP_FILE="$1"

# Verify file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' not found."
  exit 1
fi

# Confirm action
echo "WARNING: This will OVERWRITE the current database state with data from '$BACKUP_FILE'."
echo "Any data created since this backup will be LOST."
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 1
fi

# Perform restore
echo "Restoring database from '$BACKUP_FILE'..."
# Note: The backup was created with pg_dumpall -c, so it includes DROP commands to clean existing state
cat "$BACKUP_FILE" | docker exec -i $CONTAINER_NAME psql -U postgres

if [ $? -eq 0 ]; then
  echo "Restore completed successfully."
else
  echo "Restore failed! Check connection or file validity."
  exit 1
fi
