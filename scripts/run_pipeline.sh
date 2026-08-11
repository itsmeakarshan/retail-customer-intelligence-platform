#!/bin/bash
set -e

echo "================================================================="
echo " Customer Intelligence & Revenue Risk Platform - Full Pipeline "
echo "================================================================="

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
export PYTHONPATH=.

echo "1. Activating Virtual Environment..."
source .venv/bin/activate

echo "2. Running Data Cleaning Pipeline..."
python ml/src/data/clean_data.py

echo "3. Building Customer Features & Temporal Target Setup..."
python ml/src/features/build_features.py

echo "4. Training ML Models (Churn, Value, Segmentation, Explainability)..."
python ml/src/models/train_all.py

echo "5. Populating SQLite Database (retail_analytics.db)..."
python ml/src/data/populate_db.py

echo "6. Executing Automated Test Suite..."
pytest tests/test_pipeline.py backend/tests/test_api.py

echo "7. Building Frontend Production Assets..."
cd frontend
npm run build
cd "$ROOT_DIR"

echo "================================================================="
echo " Pipeline Executed & Validated Successfully! "
echo "================================================================="
