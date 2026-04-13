"""
backend/utils/response_models.py

Pydantic schemas for request and response bodies.
"""

from pydantic import BaseModel
from typing import Optional


class DynamicFeatures(BaseModel):
    strokeCount: int = 0
    totalDurationMs: float = 0
    pauseCount: int = 0
    revisionCount: int = 0
    meanStrokeVelocity: float = 0
    velocityStdDev: float = 0
    totalPauseDurationMs: float = 0
    meanPauseDurationMs: float = 0
    targetHour: Optional[int] = 11
    targetMinute: Optional[int] = 10


class ScoringRequest(BaseModel):
    imageBase64: str           # data:image/png;base64,... or raw base64
    features: DynamicFeatures


class ScoringResponse(BaseModel):
    cdtRiskScore: float        # 0–100
    riskClass: int             # 0=Normal, 1=SCD, 2=MCI, 3=High
    riskLabel: str
    flags: list[str]
    recommendation: str
    # Debug breakdown (optional, visible in dev)
    breakdown: Optional[dict] = None
