"""
backend/api/routes/oculomotor.py

Oculomotor routes for CogniSense unified backend.
"""

from fastapi import APIRouter, HTTPException, Query

from services.oculomotor_analyzer import get_oculomotor_analyzer
from utils.oculomotor_models import (
    OculomotorAnalysisRequest,
    OculomotorAnalysisResponse,
    OculomotorTaskStartResponse,
)

router = APIRouter()


@router.get("/oculomotor/health")
def oculomotor_health() -> dict:
    analyzer = get_oculomotor_analyzer()
    return analyzer.health_status()


@router.post("/oculomotor/analyze", response_model=OculomotorAnalysisResponse)
def analyze_oculomotor(request: OculomotorAnalysisRequest) -> OculomotorAnalysisResponse:
    analyzer = get_oculomotor_analyzer()
    try:
        return analyzer.analyze_metrics(request.metrics, source=request.source)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Oculomotor analysis failed: {exc}") from exc


@router.post("/oculomotor/analyze/demo", response_model=OculomotorAnalysisResponse)
def analyze_oculomotor_demo() -> OculomotorAnalysisResponse:
    analyzer = get_oculomotor_analyzer()
    return analyzer.generate_demo_result()


@router.get("/oculomotor/report/latest", response_model=OculomotorAnalysisResponse)
def analyze_oculomotor_latest_report() -> OculomotorAnalysisResponse:
    analyzer = get_oculomotor_analyzer()
    try:
        return analyzer.analyze_latest_report()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load latest oculomotor report: {exc}") from exc


@router.post("/oculomotor/task/start", response_model=OculomotorTaskStartResponse)
def start_oculomotor_camera_task(
    timeout_seconds: int = Query(default=420, ge=120, le=1800),
) -> OculomotorTaskStartResponse:
    analyzer = get_oculomotor_analyzer()
    try:
        payload = analyzer.run_standalone_task(timeout_seconds=timeout_seconds)
        return OculomotorTaskStartResponse(**payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to launch camera task: {exc}") from exc
