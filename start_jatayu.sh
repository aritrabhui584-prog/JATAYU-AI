#!/usr/bin/env bash
# JATAYU AI — Single-Port Startup Script (Linux / macOS)
# Launches unified Command & Control Platform on http://127.0.0.1:8000

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo "  JATAYU AI — Intelligent Disaster Prediction System     "
echo "  Unified Single-Port Deployment (Port 8000)             "
echo "=========================================================="

# 1. Check frontend build
if [ ! -f "$SCRIPT_DIR/frontend/dist/index.html" ]; then
    echo "[1/3] Building frontend distribution..."
    cd "$SCRIPT_DIR/frontend"
    npm run build
    cd "$SCRIPT_DIR"
else
    echo "[1/3] Frontend build verified (frontend/dist ready)."
fi

# 2. Check Python venv
VENV_PYTHON="$SCRIPT_DIR/backend/.venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
    echo "[2/3] Virtual environment not found at backend/.venv! Creating..."
    python3 -m venv "$SCRIPT_DIR/backend/.venv"
    "$SCRIPT_DIR/backend/.venv/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"
else
    echo "[2/3] Python environment verified (backend/.venv ready)."
fi

# 3. Launch Unified Server
echo "[3/3] Launching Unified Server on http://127.0.0.1:8000..."
echo ""
echo "  ➜ Operations Command Center:  http://127.0.0.1:8000/"
echo "  ➜ Interactive Swagger Docs:   http://127.0.0.1:8000/docs"
echo "  ➜ Health Check Endpoint:      http://127.0.0.1:8000/api/health"
echo "  ➜ Official SITREP (PDF):      http://127.0.0.1:8000/api/priority/export/sitrep.pdf"
echo ""
echo "Press Ctrl+C to terminate."
echo ""

cd "$SCRIPT_DIR/backend"
"$SCRIPT_DIR/backend/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000
