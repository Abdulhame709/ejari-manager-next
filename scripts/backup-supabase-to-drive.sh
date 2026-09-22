#!/usr/bin/env bash
set -Eeuo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE is required}"
: "${RCLONE_CONFIG:?RCLONE_CONFIG is required}"
: "${GDRIVE_BACKUP_PATH:=manus_google_drive:Ejari Manager Backups}"
: "${BACKUP_RETENTION_DAYS:=35}"

command -v pg_dump >/dev/null || { echo "pg_dump is required" >&2; exit 1; }
command -v gpg >/dev/null || { echo "gpg is required" >&2; exit 1; }
command -v rclone >/dev/null || { echo "rclone is required" >&2; exit 1; }

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

utc_stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
backup_name="ejari-supabase-${utc_stamp}"
dump_file="$work_dir/${backup_name}.dump"
archive_file="$work_dir/${backup_name}.dump.gpg"
manifest_file="$work_dir/${backup_name}.manifest.json"

# Custom format is compressed by pg_dump and can be restored with pg_restore.
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --dbname="$SUPABASE_DB_URL" \
  --file="$dump_file"

gpg \
  --batch \
  --yes \
  --pinentry-mode loopback \
  --symmetric \
  --cipher-algo AES256 \
  --passphrase "$BACKUP_ENCRYPTION_PASSPHRASE" \
  --output "$archive_file" \
  "$dump_file"

sha256="$(sha256sum "$archive_file" | awk '{print $1}')"
size_bytes="$(stat -c '%s' "$archive_file")"
cat > "$manifest_file" <<EOF
{
  "backup_name": "$backup_name",
  "created_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "Supabase PostgreSQL logical dump",
  "format": "pg_dump custom, encrypted with GPG AES256",
  "sha256": "$sha256",
  "size_bytes": $size_bytes,
  "retention_days": $BACKUP_RETENTION_DAYS
}
EOF

rclone copyto --config "$RCLONE_CONFIG" "$archive_file" "${GDRIVE_BACKUP_PATH}/daily/${backup_name}.dump.gpg"
rclone copyto --config "$RCLONE_CONFIG" "$manifest_file" "${GDRIVE_BACKUP_PATH}/daily/${backup_name}.manifest.json"

# Keep a monthly checkpoint on the first day of each month and a yearly
# checkpoint on January 1. These are copies of the already encrypted dump.
day_of_month="$(date -u +%d)"
month_key="$(date -u +%Y-%m)"
year_key="$(date -u +%Y)"
if [[ "$day_of_month" == "01" ]]; then
  rclone copyto --config "$RCLONE_CONFIG" "$archive_file" "${GDRIVE_BACKUP_PATH}/monthly/${month_key}.dump.gpg"
  rclone copyto --config "$RCLONE_CONFIG" "$manifest_file" "${GDRIVE_BACKUP_PATH}/monthly/${month_key}.manifest.json"
fi
if [[ "$month_key" == *-01 && "$day_of_month" == "01" ]]; then
  rclone copyto --config "$RCLONE_CONFIG" "$archive_file" "${GDRIVE_BACKUP_PATH}/yearly/${year_key}.dump.gpg"
  rclone copyto --config "$RCLONE_CONFIG" "$manifest_file" "${GDRIVE_BACKUP_PATH}/yearly/${year_key}.manifest.json"
fi

# Age-based cleanup is deterministic and does not delete files outside the
# dedicated backup path. Monthly/yearly retention is handled separately.
rclone delete --config "$RCLONE_CONFIG" "${GDRIVE_BACKUP_PATH}/daily" --min-age "${BACKUP_RETENTION_DAYS}d"
rclone delete --config "$RCLONE_CONFIG" "${GDRIVE_BACKUP_PATH}/monthly" --min-age "365d"
rclone delete --config "$RCLONE_CONFIG" "${GDRIVE_BACKUP_PATH}/yearly" --min-age "2555d"

printf 'Backup uploaded: %s (%s bytes, sha256 %s)\n' "$backup_name" "$size_bytes" "$sha256"
