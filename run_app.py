import os
import sys
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

if __name__ == "__main__":
    import uvicorn

    banner = """
========================================================================
 SUPPLY CHAIN RISK MONITOR & MITIGATION INTELLIGENCE SYSTEM
========================================================================
 Backend: FastAPI 2.0 (XGBoost Depth-14 Regressor & Classifier)
 Frontend: React 19 + Clean Industrial UI

 Application URL : http://127.0.0.1:8000
 API Swagger Docs: http://127.0.0.1:8000/docs

 To launch with hot-reloading (Vite Dev Server):
   1. Keep this terminal running for FastAPI on port 8000
   2. Open a new terminal and run: cd frontend && npm run dev
   3. Open http://localhost:5173 in your browser
========================================================================
"""
    print(banner)

    # Attempt to automatically open browser on launch
    try:
        webbrowser.open("http://127.0.0.1:8000")
    except Exception:
        pass

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
