# 🚀 Production & Docker Deployment Guide

This guide details the deployment options, environment variables, system architecture, and verification steps for the **AI Retail Customer Intelligence & Pricing Platform**.

---

## 🏗️ Deployment Architecture

```
                                    ┌────────────────────────┐
                                    │    Client / Browser    │
                                    └───────────┬────────────┘
                                                │
                                                ▼
                                    ┌────────────────────────┐
                                    │      Nginx Server      │
                                    │      (Port 5173)       │
                                    │   Serves React SPA     │
                                    └───────────┬────────────┘
                                                │
                                                ▼ /api/* Proxy
                                    ┌────────────────────────┐
                                    │     FastAPI Backend    │
                                    │      (Port 8000)       │
                                    └───────────┬────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
        ┌─────────────────────────┐                           ┌─────────────────────────┐
        │  SQLite Data Store      │                           │  Trained ML Artifacts   │
        │  retail_analytics.db    │                           │  ml/models/*.joblib     │
        └─────────────────────────┘                           └─────────────────────────┘
```

---

## 🐳 Docker Deployment (Recommended)

The platform is fully containerized with Docker Compose, providing a multi-stage production build for both the React frontend (Nginx) and FastAPI backend (Python 3.11).

### 1. Prerequisites
- Docker Engine 20.10+
- Docker Compose v2+

### 2. Environment Configuration
Create a `.env` file in the project root based on `.env.example`:
```bash
cp .env.example .env
```

Configure optional API credentials if using the Gemini Copilot or Brevo Email Service:
```ini
# Google Gemini Copilot (Optional)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Brevo Transactional Email Service (Optional)
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=retail_ops@example.com
BREVO_SENDER_NAME=Retail Operations
DEMO_EMAIL_ADDRESS=demo_recipient@example.com
```

### 3. Build & Run
```bash
# Build and start all services in detached mode
docker compose up -d --build

# Verify container status
docker compose ps
```

### 4. Service Endpoints
- **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **Interactive OpenAPI Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

### 5. Stop Containers
```bash
docker compose down
```

---

## 💻 Local Development Setup

### 1. Backend Service
```bash
# Initialize and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI backend server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Application
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

---

## 🧪 Automated Verification & Health Checks

### Run Python Test Suite (115 Tests)
```bash
./.venv/bin/python -m pytest tests/ -v
./.venv/bin/python -m pytest backend/tests/ -v
```

### Run Frontend Production Build & Typecheck
```bash
cd frontend
npx tsc --noEmit
npm run build
```

### Run Notebook Output Validation
```bash
./.venv/bin/python scripts/validate_notebooks.py
```
