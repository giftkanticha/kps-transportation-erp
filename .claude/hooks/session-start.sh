#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

cd "$CLAUDE_PROJECT_DIR"

# ── Frontend dependencies ─────────────────────────────────────────────────────
echo "[hook] Installing frontend dependencies..."
npm install

# ── Backend dependencies + DB setup ──────────────────────────────────────────
echo "[hook] Installing backend dependencies..."
cd "$CLAUDE_PROJECT_DIR/server"
npm install

echo "[hook] Setting up Prisma (SQLite)..."
npx prisma db push --skip-generate

echo "[hook] Seeding database (idempotent)..."
npx tsx src/seed.ts

# ── Start servers via pm2 (survives shell exit) ───────────────────────────────
export PM2_HOME="/root/.pm2"

# Backend
if ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "[hook] Starting backend (pm2)..."
  cd "$CLAUDE_PROJECT_DIR/server"
  DATABASE_URL="file:./dev.db" \
  JWT_SECRET="kps-erp-super-secret-jwt-key-2026" \
  REFRESH_TOKEN_SECRET="kps-erp-refresh-secret-2026" \
  PORT=3001 \
  pm2 start src/index.ts \
    --name kps-backend \
    --interpreter /opt/node22/bin/node \
    "--interpreter-args=--require $CLAUDE_PROJECT_DIR/server/node_modules/tsx/dist/preflight.cjs --import file://$CLAUDE_PROJECT_DIR/server/node_modules/tsx/dist/loader.mjs" \
    --cwd "$CLAUDE_PROJECT_DIR/server"
  for i in $(seq 1 20); do
    curl -sf http://localhost:3001/api/health > /dev/null 2>&1 && echo "[hook] Backend ready" && break
    sleep 1
  done
else
  echo "[hook] Backend already running"
fi

# Frontend
if ! curl -sf http://localhost:5173 > /dev/null 2>&1; then
  echo "[hook] Starting frontend (pm2)..."
  cd "$CLAUDE_PROJECT_DIR"
  pm2 start "npx vite --host 0.0.0.0 --port 5173" \
    --name kps-frontend \
    --cwd "$CLAUDE_PROJECT_DIR"
  sleep 6
  echo "[hook] Frontend started"
else
  echo "[hook] Frontend already running"
fi

echo "[hook] Setup complete ✅"
