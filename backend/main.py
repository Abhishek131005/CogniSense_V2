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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.score import router as score_router
from services.cnn_scorer import get_cnn_scorer

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Lifespan: load heavy models once at startup ───────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CogniSense CDT API — loading CNN scorer...")
    get_cnn_scorer()   # warms up the singleton
    logger.info("CNN scorer ready.")
    yield
    logger.info("Shutting down CogniSense CDT API.")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CogniSense CDT Scoring API",
    description=(
        "Analyzes clock drawing test (CDT) images and dynamic motor features "
        "to produce a cognitive risk score for pre-clinical Alzheimer's screening."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the React dev server + future Firebase Hosting domain
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://cognisense-92c8b.web.app",   # update with your Firebase Hosting URL
    "https://cognisense-92c8b.firebaseapp.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(score_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint — friendly welcome message."""
    return {"message": "CogniSense CDT API is running. The React app should connect to this."}

@app.get("/health")
async def health_check():
    """Simple health check — confirms API is up."""
    return {"status": "ok", "service": "CogniSense CDT API", "version": "1.0.0"}
