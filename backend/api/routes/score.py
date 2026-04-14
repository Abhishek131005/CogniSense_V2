"""
backend/api/routes/score.py

POST /api/score/cdt — main CDT scoring endpoint.
"""

import logging
from fastapi import APIRouter, HTTPException

from utils.response_models import ScoringRequest, ScoringResponse
from utils.image_utils     import base64_to_pil

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/score/cdt", response_model=ScoringResponse)
async def score_cdt(request: ScoringRequest) -> ScoringResponse:
    """
    Analyze a submitted clock drawing and return a CDT risk score.

    Accepts:
      - imageBase64: base64 PNG data URL of the drawn clock
      - features: dynamic motor features computed client-side (strokeCount, etc.)

    Returns:
      - cdtRiskScore (0–100)
      - riskClass (0–3)
      - riskLabel (string)
      - flags (list of clinical flag strings)
      - recommendation (string)
      - breakdown (debug: heuristic/CNN scores + image features)
    """
    try:
        img = base64_to_pil(request.imageBase64)
    except Exception as e:
        logger.error(f"Failed to decode image: {e}")
        raise HTTPException(status_code=422, detail=f"Invalid imageBase64: {e}")

    try:
        from services.score_fusion import run_full_pipeline

        dynamic = request.features.model_dump()
        result  = run_full_pipeline(img, dynamic)
        return result
    except Exception as e:
        logger.exception("Scoring pipeline error")
        raise HTTPException(status_code=500, detail=f"Scoring pipeline error: {e}")
