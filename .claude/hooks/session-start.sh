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

# ── Start backend server ──────────────────────────────────────────────────────
if ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "[hook] Starting backend server on port 3001..."
  bash -c 'cd '"$CLAUDE_PROJECT_DIR"'/server && npm run dev > /tmp/kps-server.log 2>&1' &
  disown $!
  for i in $(seq 1 20); do
    if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
      echo "[hook] Backend ready"
      break
    fi
    sleep 1
  done
else
  echo "[hook] Backend already running"
fi

# ── Start Vite frontend ───────────────────────────────────────────────────────
cd "$CLAUDE_PROJECT_DIR"
if ! curl -sf http://localhost:5173 > /dev/null 2>&1; then
  echo "[hook] Starting Vite frontend on port 5173..."
  bash -c 'cd '"$CLAUDE_PROJECT_DIR"' && npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/kps-vite.log 2>&1' &
  disown $!
  echo "[hook] Vite starting in background"
else
  echo "[hook] Frontend already running"
fi

echo "[hook] Setup complete ✅"
