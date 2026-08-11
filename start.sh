#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "================================================================="
echo " Starting Customer Intelligence & Revenue Risk Platform "
echo "================================================================="

# Kill existing uvicorn or vite processes if running
pkill -f "uvicorn backend.app.main:app" || true

echo "Starting FastAPI Backend Server on http://localhost:8000 ..."
.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting React Frontend Dev Server on http://localhost:5173 ..."
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!

cd "$ROOT_DIR"

echo "================================================================="
echo " Application Services Online! "
echo " Backend API:  http://localhost:8000"
echo " API Docs:     http://localhost:8000/docs"
echo " React UI:     http://localhost:5173"
echo "================================================================="

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
