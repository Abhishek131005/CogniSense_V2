"""
backend/api/routes/speech.py

Speech module routes for CogniSense.
"""

import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

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
        return analyzer.analyze(tmp_path, language=language)
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
