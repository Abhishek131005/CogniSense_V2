"""
backend/utils/speech_models.py

Pydantic models for CogniSense Speech Module responses.
"""

from typing import List

from pydantic import BaseModel


class AcousticFeatures(BaseModel):
    mfcc_means: List[float]
    spectral_centroid_hz: float
    spectral_rolloff_hz: float
    spectral_bandwidth_hz: float
    zero_crossing_rate: float
    vocal_energy_mean: float
    vocal_energy_std: float
    pause_count: int
    pause_ratio: float
    mean_pause_duration_ms: float
    total_silence_ratio: float
    f0_mean_hz: float
    f0_std_hz: float
    f0_range_hz: float
    jitter: float
    shimmer: float
    hnr_db: float
    speech_rate_syllables_per_min: float
    formant_f1_hz: float
    formant_f2_hz: float


class LexicoSemanticFeatures(BaseModel):
    transcript: str
    detected_language: str
    word_count: int
    unique_word_count: int
    type_token_ratio: float
    guiraud_r: float
    mean_word_length: float
    filler_word_count: int
    filler_word_ratio: float
    repetition_ratio: float
    hapax_ratio: float


class RiskInterpretation(BaseModel):
    risk_class: str
    score_band: str
    clinical_summary: str
    recommended_action: str
    key_flags: List[str]


class SpeechAnalysisResult(BaseModel):
    duration_seconds: float
    acoustic: AcousticFeatures
    lexico_semantic: LexicoSemanticFeatures
    risk_score: float
    risk_class: str
    interpretation: RiskInterpretation
    model_used: str
    wav2vec_available: bool
