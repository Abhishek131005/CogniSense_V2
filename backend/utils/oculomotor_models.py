"""
backend/utils/oculomotor_models.py

Pydantic models for CogniSense Oculomotor module requests/responses.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class OculomotorMetrics(BaseModel):
    """Input metrics for integrated oculomotor risk estimation."""

    trial_count: int = Field(default=20, ge=1, le=120)
    antisaccade_errors: int = Field(default=0, ge=0)
    avg_latency_ms: float = Field(default=280.0, ge=0.0, le=3000.0)
    fixation_rmsd: float = Field(default=0.08, ge=0.0, le=2.0)
    pursuit_gain: float | None = Field(default=None, ge=0.0, le=2.0)

    @model_validator(mode="after")
    def validate_error_count(self) -> "OculomotorMetrics":
        if self.antisaccade_errors > self.trial_count:
            raise ValueError("antisaccade_errors cannot exceed trial_count")
        return self


class OculomotorAnalysisRequest(BaseModel):
    """Request payload for oculomotor analysis."""

    metrics: OculomotorMetrics
    source: Literal["manual", "demo", "pipeline-report"] = "manual"


class OculomotorMetricsSummary(BaseModel):
    """Normalized metrics returned to frontend and persistence layer."""

    trial_count: int
    antisaccade_errors: int
    error_rate_percent: float
    avg_latency_ms: float
    fixation_rmsd: float
    pursuit_gain: float | None


class OculomotorAnalysisResponse(BaseModel):
    """Unified oculomotor analysis response."""

    risk_score: float
    risk_class: int
    risk_label: str
    clinical_risk: Literal["Low", "Medium", "High"]
    flags: list[str]
    recommendation: str
    metrics: OculomotorMetricsSummary
    model_used: str
    backend_mode: str
    breakdown: dict | None = None


class OculomotorTaskStartResponse(BaseModel):
    """Response payload for launching the standalone camera task."""

    status: Literal["completed", "failed", "timed_out"]
    message: str
    elapsed_seconds: float
    report_available: bool
    report_updated: bool
    stdout_tail: list[str] = Field(default_factory=list)
    stderr_tail: list[str] = Field(default_factory=list)
