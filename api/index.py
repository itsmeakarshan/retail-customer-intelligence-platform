import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_ROOT = os.path.join(PROJECT_ROOT, "backend")

for p in [PROJECT_ROOT, BACKEND_ROOT]:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.app.main import app
except (ImportError, ModuleNotFoundError):
    from app.main import app
