#!/bin/sh
# Container entrypoint: wait for MySQL, sync the schema, seed the first admin,
# then start the API. `prisma db push` doubles as the readiness probe — it only
# succeeds once MySQL accepts connections.
set -e

echo "[start] waiting for MySQL and syncing schema..."
until npx prisma db push --schema prisma/schema.mysql.prisma --skip-generate --accept-data-loss; do
  echo "[start] database not ready — retrying in 3s"
  sleep 3
done

echo "[start] seeding initial admin (idempotent)..."
node dist/seed.js || echo "[start] seed skipped/failed (continuing)"

echo "[start] launching API on :${PORT:-3001}"
exec node dist/index.js
