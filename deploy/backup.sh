#!/bin/sh
# Automated database backup loop. Runs inside a mysql:8.0 container alongside the
# stack: dumps the whole database to /backups on a schedule and prunes old files.
# Point BACKUP_DIR (compose) at a cloud-synced folder (OneDrive / Google Drive)
# to get an off-site copy automatically.
set -u

DB="${MYSQL_DATABASE:-kps_erp}"
INTERVAL="${BACKUP_INTERVAL:-86400}"     # seconds between backups (default: daily)
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"      # delete dumps older than this many days

echo "[backup] started — db=$DB every ${INTERVAL}s, keep ${KEEP_DAYS} days"

while true; do
  TS=$(date +%Y%m%d-%H%M%S)
  OUT="/backups/${DB}-${TS}.sql"
  echo "[backup] dumping $DB -> $OUT"
  if mysqldump -h mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" \
       --single-transaction --routines --no-tablespaces "$DB" > "$OUT" 2>/tmp/dumperr; then
    echo "[backup] ok: $(ls -lh "$OUT" | awk '{print $5}')"
  else
    echo "[backup] FAILED:"; cat /tmp/dumperr
    rm -f "$OUT"
  fi
  # Prune old dumps (non-fatal if find/mtime unavailable).
  find /backups -name "${DB}-*.sql" -type f -mtime "+${KEEP_DAYS}" -delete 2>/dev/null || true
  sleep "$INTERVAL"
done
