"""
backend/main.py

CogniSense CDT Scoring API — FastAPI entry point.
Runs on http://localhost:8000

Startup:
  - Loads the CNN scorer (ResNet-18) — happens once at launch
  - Mounts /api router with CDT scoring endpoint
  - Configures CORS to allow requests from the React frontend

Usage:
  cd backend
  uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from api.routes.score import router as score_router
from api.routes.speech import router as speech_router
from api.routes.oculomotor import router as oculomotor_router

BACKEND_DIR = Path(__file__).resolve().parent
COGNISENSE_DIR = BACKEND_DIR.parent
REPO_ROOT = COGNISENSE_DIR.parent

# Load backend/runtime env vars from both local and workspace-level .env files.
load_dotenv(COGNISENSE_DIR / ".env")
load_dotenv(REPO_ROOT / ".env")

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Lifespan: load heavy models once at startup ───────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CogniSense Unified API...")
    yield
    logger.info("Shutting down CogniSense Unified API.")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CogniSense Unified Screening API",
    description=(
        "Unified API for CogniSense modules: Clock Drawing Test (CDT), "
        "Speech biomarkers, and Oculomotor assessment for pre-clinical "
        "Alzheimer's screening."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the React dev server + future Firebase Hosting domain
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "https://cognisense-92c8b.web.app",   # update with your Firebase Hosting URL
    "https://cognisense-92c8b.firebaseapp.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):(\d+)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(score_router, prefix="/api")
app.include_router(speech_router, prefix="/api")
app.include_router(oculomotor_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint — friendly welcome message."""
    return {
        "message": "CogniSense API is running.",
        "modules": ["cdt", "speech", "oculomotor"],
    }

@app.get("/health")
async def health_check():
    """Simple health check — confirms API is up."""
    return {"status": "ok", "service": "CogniSense Unified API", "version": "1.0.0"}


# ── Startup ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
