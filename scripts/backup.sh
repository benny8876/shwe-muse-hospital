#!/bin/sh
set -e
TS=$(date +%Y%m%d_%H%M%S)
FILE="/backups/shwemuse_${TS}.sql"
echo "Backing up to $FILE"
pg_dump -h db -U shwemuse shwemuse > "$FILE"
echo "Done"
