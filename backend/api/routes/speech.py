"""
backend/api/routes/speech.py

Speech module routes for CogniSense.
"""

import os
import tempfile
import asyncio

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from utils.speech_models import SpeechAnalysisResult

router = APIRouter()


@router.get("/speech/health")
def speech_health() -> dict:
    from services.speech_analyzer import get_speech_analyzer

    analyzer = get_speech_analyzer()
    active_model = analyzer.asr_effective_model_id or analyzer.asr_model_id
    return {
        "status": "ok",
        "module": "speech",
        "model_loaded": analyzer.model_loaded,
        "asr_model_id": active_model,
        "asr_requested_model_id": analyzer.asr_model_id,
    }


@router.post("/speech/analyze", response_model=SpeechAnalysisResult)
async def analyze_speech(
    file: UploadFile = File(...),
    language: str = Form("auto"),
) -> SpeechAnalysisResult:
    from services.speech_analyzer import get_speech_analyzer

    analyzer = get_speech_analyzer()

    suffix = os.path.splitext(file.filename or "sample.wav")[-1] or ".wav"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        try:
            timeout_seconds = max(30, int(os.getenv("COGNISENSE_SPEECH_ANALYZE_TIMEOUT_SECONDS", "120")))
        except Exception:
            timeout_seconds = 120

        return await asyncio.wait_for(
            run_in_threadpool(analyzer.analyze, tmp_path, language),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=(
                "Speech analysis timed out. Please try a shorter recording "
                "or switch language to Auto-detect."
            ),
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Speech analysis failed: {exc}") from exc
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/speech/analyze/demo", response_model=SpeechAnalysisResult)
def analyze_demo() -> SpeechAnalysisResult:
    from services.speech_analyzer import get_speech_analyzer

    analyzer = get_speech_analyzer()
    return analyzer.generate_demo_result()
