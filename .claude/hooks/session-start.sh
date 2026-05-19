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

# ── Start Vite dev server via pm2 ────────────────────────────────────────────
export PM2_HOME="/root/.pm2"

if ! curl -sf http://localhost:5173 > /dev/null 2>&1; then
  echo "[hook] Starting frontend (pm2)..."
  pm2 start "npx vite --host 0.0.0.0 --port 5173" \
    --name kps-frontend \
    --cwd "$CLAUDE_PROJECT_DIR"
  sleep 6
  echo "[hook] Frontend started"
else
  echo "[hook] Frontend already running"
fi

echo "[hook] Setup complete ✅"
