"""
backend/services/speech_analyzer.py

CogniSense speech feature extraction and risk scoring.
Designed to be dependency-tolerant so the module stays usable even when
optional speech libraries (librosa/transformers) are unavailable.
"""

from __future__ import annotations

import os
import random
import re
import subprocess
import wave
import logging
import importlib.util
import warnings
from collections import Counter
from dataclasses import dataclass
from typing import Optional

import numpy as np
import scipy.signal

from utils.speech_models import (
    AcousticFeatures,
    LexicoSemanticFeatures,
    RiskInterpretation,
    SpeechAnalysisResult,
)

try:
    import librosa

    LIBROSA_OK = True
except Exception:
    LIBROSA_OK = False

try:
    import imageio_ffmpeg

    IMAGEIO_FFMPEG_OK = True
except Exception:
    IMAGEIO_FFMPEG_OK = False

torch = None
pipeline = None
ASR_OK = (
    importlib.util.find_spec("torch") is not None
    and importlib.util.find_spec("transformers") is not None
)

try:
    from langdetect import detect as detect_language

    LANGDETECT_OK = True
except Exception:
    LANGDETECT_OK = False

FILLER_SET_BY_LANG = {
    "en": {"uh", "um", "er", "ah", "like", "well", "actually", "you", "know"},
    "hi": {"uh", "um", "मतलब", "तो", "हां"},
    "mr": {"uh", "um", "म्हणजे", "तर", "हो"},
}

LOW_CONFIDENCE_MESSAGE_BY_LANG = {
    "en": "Low-confidence transcript. Please record again in a quieter place and read the full paragraph continuously.",
    "hi": "प्रतिलिपि स्पष्ट नहीं है। कृपया शांत कमरे में दोबारा रिकॉर्ड करें और पूरा अनुच्छेद लगातार पढ़ें।",
    "mr": "लिप्यंतरण स्पष्ट नाही. कृपया शांत ठिकाणी पुन्हा रेकॉर्ड करा आणि पूर्ण परिच्छेद सलग वाचा.",
    "bn": "ট্রান্সক্রিপ্ট স্পষ্ট নয়। শান্ত জায়গায় আবার রেকর্ড করুন এবং পুরো অনুচ্ছেদ পড়ুন।",
    "ta": "உரை தெளிவாக கிடைக்கவில்லை. அமைதியான இடத்தில் மீண்டும் பதிவு செய்து முழு பகுதியில் வாசிக்கவும்.",
    "te": "ట్రాన్స్క్రిప్ట్ స్పష్టంగా లేదు. నిశ్శబ్ద ప్రదేశంలో మళ్లీ రికార్డ్ చేసి మొత్తం ప్యారాగ్రాఫ్ చదవండి.",
    "gu": "ટ્રાન્સક્રિપ્ટ સ્પષ્ટ નથી. શાંત જગ્યાએ ફરીથી રેકોર્ડ કરીને પૂરું પેરાગ્રાફ વાંચો.",
    "kn": "ಟ್ರಾನ್ಸ್ಕ್ರಿಪ್ಟ್ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ಶಾಂತ ಸ್ಥಳದಲ್ಲಿ ಮತ್ತೆ ರೆಕಾರ್ಡ್ ಮಾಡಿ ಪೂರ್ಣ ಪ್ಯಾರಾಗ್ರಾಫ್ ಓದಿ.",
    "ml": "ട്രാൻസ്ക്രിപ്റ്റ് വ്യക്തമായില്ല. ശാന്തമായ ഇടത്ത് വീണ്ടും റെക്കോർഡ് ചെയ്ത് മുഴുവൻ പാരഗ്രാഫും വായിക്കൂ.",
    "pa": "ਟ੍ਰਾਂਸਕ੍ਰਿਪਟ ਸਪਸ਼ਟ ਨਹੀਂ ਆਇਆ। ਕਿਰਪਾ ਕਰਕੇ ਸ਼ਾਂਤ ਥਾਂ ਤੇ ਮੁੜ ਰਿਕਾਰਡ ਕਰੋ ਅਤੇ ਪੂਰਾ ਪੈਰਾਗ੍ਰਾਫ ਪੜ੍ਹੋ।",
}

SCRIPT_REGEX_BY_LANG = {
    "en": r"[A-Za-z]",
    "hi": r"[\u0900-\u097F]",
    "mr": r"[\u0900-\u097F]",
    "bn": r"[\u0980-\u09FF]",
    "ta": r"[\u0B80-\u0BFF]",
    "te": r"[\u0C00-\u0C7F]",
    "gu": r"[\u0A80-\u0AFF]",
    "kn": r"[\u0C80-\u0CFF]",
    "ml": r"[\u0D00-\u0D7F]",
    "pa": r"[\u0A00-\u0A7F]",
}

WHISPER_LANGUAGE_TOKEN_BY_CODE = {
    "en": "english",
    "hi": "hindi",
    "mr": "marathi",
    "bn": "bengali",
    "ta": "tamil",
    "te": "telugu",
    "gu": "gujarati",
    "kn": "kannada",
    "ml": "malayalam",
    "pa": "punjabi",
}

logger = logging.getLogger(__name__)


@dataclass
class _PitchStats:
    mean: float
    std: float
    range_hz: float


class SpeechAnalyzer:
    def __init__(self) -> None:
        self.model_loaded = False
        self.asr_pipeline = None
        self.asr_model_id = os.getenv("COGNISENSE_ASR_MODEL", "openai/whisper-small")
        fallback_models_raw = os.getenv(
            "COGNISENSE_ASR_FALLBACK_MODELS",
            "openai/whisper-base,openai/whisper-tiny",
        )
        self.asr_fallback_models = [
            model_id.strip()
            for model_id in str(fallback_models_raw).split(",")
            if model_id and model_id.strip()
        ]
        try:
            self.asr_chunk_length_s = max(10, int(os.getenv("COGNISENSE_ASR_CHUNK_LENGTH_S", "15")))
        except Exception:
            self.asr_chunk_length_s = 15
        try:
            self.asr_max_audio_seconds = max(
                10,
                int(os.getenv("COGNISENSE_ASR_MAX_AUDIO_SECONDS", "35")),
            )
        except Exception:
            self.asr_max_audio_seconds = 35
        self.asr_effective_model_id = None
        self.asr_enable_retry = os.getenv("COGNISENSE_ASR_ENABLE_RETRY", "false").lower() == "true"
        self.enable_asr = os.getenv("COGNISENSE_ENABLE_ASR", "true").lower() == "true"
        self._load_asr()

    def _load_asr(self) -> None:
        global torch, pipeline, ASR_OK

        if not self.enable_asr or not ASR_OK:
            return

        if torch is None or pipeline is None:
            try:
                import torch as _torch
                from transformers import pipeline as _pipeline
                from transformers.utils import logging as _hf_logging

                torch = _torch
                pipeline = _pipeline
                _hf_logging.set_verbosity_error()
            except Exception as exc:
                logger.warning("ASR dependencies unavailable: %s", exc)
                ASR_OK = False
                return

        device = 0 if torch.cuda.is_available() else -1
        candidates = []
        for model_id in [self.asr_model_id, *self.asr_fallback_models]:
            if model_id and model_id not in candidates:
                candidates.append(model_id)

        for candidate_model_id in candidates:
            try:
                self.asr_pipeline = pipeline(
                    "automatic-speech-recognition",
                    model=candidate_model_id,
                    device=device,
                    chunk_length_s=self.asr_chunk_length_s,
                )
                model = getattr(self.asr_pipeline, "model", None)
                if model is not None:
                    cfg = getattr(model, "config", None)
                    if cfg is not None and hasattr(cfg, "forced_decoder_ids"):
                        cfg.forced_decoder_ids = None
                    gen_cfg = getattr(model, "generation_config", None)
                    if gen_cfg is not None and hasattr(gen_cfg, "forced_decoder_ids"):
                        gen_cfg.forced_decoder_ids = None
                self.asr_effective_model_id = candidate_model_id
                self.model_loaded = True
                return
            except Exception as exc:
                logger.warning("ASR model load failed for %s: %s", candidate_model_id, exc)

        self.asr_pipeline = None
        self.asr_effective_model_id = None
        self.model_loaded = False

    def analyze(self, audio_path: str, language: str = "auto") -> SpeechAnalysisResult:
        y, sr = self._load_audio(audio_path)
        duration = len(y) / sr if sr > 0 else 0.0

        acoustic = self._extract_acoustic(y, sr, duration)
        lexico = self._extract_lexico(y, sr, language=language)
        risk_score = self._score(acoustic, lexico, duration)
        interpretation = self._interpret(risk_score, acoustic, lexico)

        return SpeechAnalysisResult(
            duration_seconds=round(duration, 2),
            acoustic=acoustic,
            lexico_semantic=lexico,
            risk_score=round(risk_score, 1),
            risk_class=interpretation.risk_class,
            interpretation=interpretation,
            model_used="CogniSense Speech v1 (acoustic+lexical)",
            wav2vec_available=self.model_loaded,
        )

    def _load_audio(self, audio_path: str) -> tuple[np.ndarray, int]:
        if LIBROSA_OK:
            y, sr = librosa.load(audio_path, sr=16000, mono=True)
            return y.astype(np.float32), int(sr)

        if IMAGEIO_FFMPEG_OK:
            try:
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                cmd = [
                    ffmpeg_exe,
                    "-v",
                    "error",
                    "-i",
                    audio_path,
                    "-f",
                    "f32le",
                    "-acodec",
                    "pcm_f32le",
                    "-ac",
                    "1",
                    "-ar",
                    "16000",
                    "-",
                ]
                proc = subprocess.run(cmd, capture_output=True, check=True)
                data = np.frombuffer(proc.stdout, dtype=np.float32)
                if data.size > 0:
                    return data.astype(np.float32), 16000
            except Exception:
                # If ffmpeg decode fails, try WAV parser fallback below.
                pass

        if not audio_path.lower().endswith(".wav"):
            raise RuntimeError(
                "Could not decode audio file. Install imageio-ffmpeg or librosa for mp3/webm support."
            )

        with wave.open(audio_path, "rb") as wf:
            sr = wf.getframerate()
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            raw = wf.readframes(wf.getnframes())

        if sample_width == 1:
            data = np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
            data = (data - 128.0) / 128.0
        elif sample_width == 2:
            data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        else:
            raise RuntimeError("Unsupported WAV bit depth.")

        if n_channels > 1:
            data = data.reshape(-1, n_channels).mean(axis=1)

        return data.astype(np.float32), int(sr)

    def _extract_acoustic(self, y: np.ndarray, sr: int, duration: float) -> AcousticFeatures:
        if y.size == 0 or sr <= 0:
            return self._empty_acoustic()

        frame_len = max(1, int(0.03 * sr))
        hop = max(1, int(0.01 * sr))

        frame_rms = []
        for start in range(0, max(1, len(y) - frame_len), hop):
            frame = y[start : start + frame_len]
            frame_rms.append(float(np.sqrt(np.mean(frame**2)) + 1e-12))

        frame_rms_np = np.array(frame_rms, dtype=np.float64)
        if frame_rms_np.size == 0:
            frame_rms_np = np.array([0.0], dtype=np.float64)

        silence_threshold = float(np.percentile(frame_rms_np, 25) * 0.9)
        speech_mask = frame_rms_np > silence_threshold
        silence_frames = int((~speech_mask).sum())
        total_frames = int(frame_rms_np.size)

        pauses = []
        min_pause_frames = max(1, int(0.2 / (hop / sr)))
        run = 0
        for is_speech in speech_mask:
            if is_speech:
                if run >= min_pause_frames:
                    pauses.append(run)
                run = 0
            else:
                run += 1
        if run >= min_pause_frames:
            pauses.append(run)

        pause_count = len(pauses)
        mean_pause_ms = float(np.mean(pauses) * hop / sr * 1000.0) if pauses else 0.0
        silence_ratio = silence_frames / total_frames if total_frames else 0.0
        speech_frames = max(1, total_frames - silence_frames)
        pause_ratio = silence_frames / speech_frames

        zcr = float(np.mean(np.abs(np.diff(np.signbit(y).astype(np.int8)))))
        energy_mean = float(frame_rms_np.mean())
        energy_std = float(frame_rms_np.std())

        nperseg = min(512, len(y))
        if nperseg < 32:
            nperseg = len(y)
        if nperseg <= 1:
            nperseg = 2

        noverlap = min(nperseg // 2, nperseg - 1)
        freqs, _, sxx = scipy.signal.spectrogram(
            y,
            fs=sr,
            nperseg=nperseg,
            noverlap=noverlap,
            mode="magnitude",
        )

        if sxx.size == 0:
            centroid = 0.0
            rolloff = 0.0
            bandwidth = 0.0
            mfcc_means = [0.0] * 13
        else:
            mean_spec = np.mean(sxx, axis=1) + 1e-12
            centroid = float(np.sum(freqs * mean_spec) / np.sum(mean_spec))
            cumulative = np.cumsum(mean_spec)
            cutoff = cumulative[-1] * 0.85
            rolloff_idx = int(np.searchsorted(cumulative, cutoff))
            rolloff_idx = min(max(rolloff_idx, 0), len(freqs) - 1)
            rolloff = float(freqs[rolloff_idx])
            bandwidth = float(
                np.sqrt(np.sum(((freqs - centroid) ** 2) * mean_spec) / np.sum(mean_spec))
            )
            log_spec = np.log(mean_spec)
            cepstral = np.fft.rfft(log_spec, n=26).real
            mfcc_means = [float(x) for x in cepstral[:13]]
            if len(mfcc_means) < 13:
                mfcc_means.extend([0.0] * (13 - len(mfcc_means)))

        speech_rate = self._estimate_speech_rate(frame_rms_np, hop, sr, duration, silence_ratio)
        pitch = self._estimate_pitch(y, sr)

        return AcousticFeatures(
            mfcc_means=[round(v, 4) for v in mfcc_means],
            spectral_centroid_hz=round(centroid, 2),
            spectral_rolloff_hz=round(rolloff, 2),
            spectral_bandwidth_hz=round(bandwidth, 2),
            zero_crossing_rate=round(zcr, 6),
            vocal_energy_mean=round(energy_mean, 6),
            vocal_energy_std=round(energy_std, 6),
            pause_count=pause_count,
            pause_ratio=round(float(pause_ratio), 5),
            mean_pause_duration_ms=round(mean_pause_ms, 2),
            total_silence_ratio=round(float(silence_ratio), 5),
            f0_mean_hz=round(pitch.mean, 3),
            f0_std_hz=round(pitch.std, 3),
            f0_range_hz=round(pitch.range_hz, 3),
            jitter=0.0,
            shimmer=0.0,
            hnr_db=0.0,
            speech_rate_syllables_per_min=round(float(speech_rate), 2),
            formant_f1_hz=0.0,
            formant_f2_hz=0.0,
        )

    def _estimate_speech_rate(
        self,
        frame_rms: np.ndarray,
        hop: int,
        sr: int,
        duration: float,
        silence_ratio: float,
    ) -> float:
        if frame_rms.size == 0:
            return 0.0

        smooth = scipy.signal.medfilt(frame_rms, kernel_size=5)
        peak_height = float(np.percentile(smooth, 60))
        min_distance = max(1, int(0.12 / (hop / sr)))
        peaks, _ = scipy.signal.find_peaks(smooth, height=peak_height, distance=min_distance)

        active_duration = duration * max(0.2, 1.0 - silence_ratio)
        if active_duration <= 0:
            active_duration = duration if duration > 0 else 1.0

        return max(0.0, min(400.0, (len(peaks) / active_duration) * 60.0))

    def _estimate_pitch(self, y: np.ndarray, sr: int) -> _PitchStats:
        if y.size < sr // 4:
            return _PitchStats(mean=0.0, std=0.0, range_hz=0.0)

        frame_len = int(0.04 * sr)
        hop = int(0.02 * sr)
        min_lag = max(1, int(sr / 500))
        max_lag = max(min_lag + 1, int(sr / 70))

        f0_values = []
        for start in range(0, len(y) - frame_len, hop):
            frame = y[start : start + frame_len]
            if np.sqrt(np.mean(frame**2)) < 0.01:
                continue
            frame = frame - frame.mean()
            ac = scipy.signal.correlate(frame, frame, mode="full")
            ac = ac[len(ac) // 2 :]
            if max_lag >= len(ac):
                continue
            band = ac[min_lag:max_lag]
            if band.size == 0:
                continue
            lag = int(np.argmax(band) + min_lag)
            if ac[0] <= 0 or band.max() < 0.2 * ac[0]:
                continue
            f0 = sr / lag
            if 70.0 <= f0 <= 500.0:
                f0_values.append(float(f0))

        if not f0_values:
            return _PitchStats(mean=0.0, std=0.0, range_hz=0.0)

        arr = np.array(f0_values, dtype=np.float64)
        return _PitchStats(
            mean=float(arr.mean()),
            std=float(arr.std()),
            range_hz=float(arr.max() - arr.min()),
        )

    def _extract_lexico(self, y: np.ndarray, sr: int, language: str = "auto") -> LexicoSemanticFeatures:
        transcript = ""
        selected_language = self._normalize_language_code(language or "auto")
        detected_language = selected_language

        if self.model_loaded and self.asr_pipeline is not None:
            try:
                asr_array = self._prepare_asr_audio(y, sr)

                out = self._transcribe_audio(
                    asr_array,
                    sr,
                    language_code=selected_language,
                    strict=False,
                )
                transcript = str(out.get("text") or "").strip()
                if selected_language == "auto":
                    detected_language = self._normalize_language_code(out.get("language") or "unknown")
                    if detected_language == "unknown":
                        detected_language = self._detect_language_from_text(transcript)
                else:
                    # Keep lexical analysis and UI language aligned with clinician selection.
                    detected_language = selected_language

                # Second-pass retry for selected languages when first pass is weak or script-mismatched.
                if self.asr_enable_retry and selected_language != "auto" and (
                    self._is_low_information_transcript(transcript)
                    or self._script_mismatch(transcript, selected_language)
                ):
                    retry_out = self._transcribe_audio(
                        asr_array,
                        sr,
                        language_code=selected_language,
                        strict=True,
                    )
                    retry_text = str(retry_out.get("text") or "").strip()
                    transcript = self._choose_better_transcript(
                        transcript,
                        retry_text,
                        selected_language,
                    )

                    # Marathi rescue pass: Hindi token can improve Devanagari decoding quality
                    # on weak Marathi clips; pick whichever transcript scores better.
                    if selected_language == "mr" and (
                        self._is_low_information_transcript(transcript)
                        or self._script_mismatch(transcript, selected_language)
                    ):
                        hindi_retry_out = self._transcribe_audio(
                            asr_array,
                            sr,
                            language_code="hi",
                            strict=True,
                        )
                        hindi_retry_text = str(hindi_retry_out.get("text") or "").strip()
                        transcript = self._choose_better_transcript(
                            transcript,
                            hindi_retry_text,
                            selected_language,
                        )
            except Exception:
                transcript = ""

        if not transcript:
            transcript = self._localized_low_confidence_message(detected_language)
            if detected_language in ("auto", "unknown"):
                detected_language = "en"

        if detected_language in ("auto", "unknown"):
            detected_language = self._detect_language_from_text(transcript)

        if self._is_low_information_transcript(transcript):
            has_letters = bool(re.search(r"[A-Za-z\u0900-\u0D7F]", transcript or ""))
            if not has_letters:
                transcript = self._localized_low_confidence_message(
                    selected_language if selected_language != "auto" else detected_language
                )

        if selected_language not in ("auto", "unknown", "en") and self._script_mismatch(
            transcript,
            selected_language,
        ):
            transcript = self._localized_low_confidence_message(selected_language)

        clean_text = re.sub(r"[^\w\s']", " ", transcript.lower(), flags=re.UNICODE)
        words = [w for w in clean_text.split() if w]
        word_count = len(words)
        unique_count = len(set(words))

        ttr = unique_count / word_count if word_count > 0 else 0.0
        guiraud_r = unique_count / np.sqrt(word_count) if word_count > 0 else 0.0
        mean_word_len = float(np.mean([len(w) for w in words])) if words else 0.0

        filler_set = FILLER_SET_BY_LANG.get(detected_language, FILLER_SET_BY_LANG["en"])
        filler_count = sum(1 for w in words if w in filler_set)
        filler_ratio = filler_count / word_count if word_count > 0 else 0.0

        bigrams = list(zip(words, words[1:]))
        repetition_ratio = (
            (len(bigrams) - len(set(bigrams))) / len(bigrams) if bigrams else 0.0
        )

        counts = Counter(words)
        hapax = sum(1 for c in counts.values() if c == 1)
        hapax_ratio = hapax / unique_count if unique_count > 0 else 0.0

        return LexicoSemanticFeatures(
            transcript=transcript,
            detected_language=detected_language,
            word_count=word_count,
            unique_word_count=unique_count,
            type_token_ratio=round(ttr, 6),
            guiraud_r=round(guiraud_r, 4),
            mean_word_length=round(mean_word_len, 4),
            filler_word_count=filler_count,
            filler_word_ratio=round(filler_ratio, 6),
            repetition_ratio=round(repetition_ratio, 5),
            hapax_ratio=round(hapax_ratio, 4),
        )

    def _score(
        self,
        a: AcousticFeatures,
        l: LexicoSemanticFeatures,
        duration: float,
    ) -> float:
        score = 0.0

        if a.pause_ratio >= 0.50:
            score += 28
        elif a.pause_ratio >= 0.35:
            score += 18
        elif a.pause_ratio >= 0.25:
            score += 9

        if a.speech_rate_syllables_per_min > 0:
            if a.speech_rate_syllables_per_min < 140:
                score += 20
            elif a.speech_rate_syllables_per_min < 180:
                score += 12
            elif a.speech_rate_syllables_per_min < 220:
                score += 5
        else:
            score += 8

        if l.word_count >= 20:
            if l.type_token_ratio < 0.40:
                score += 18
            elif l.type_token_ratio < 0.50:
                score += 11
            elif l.type_token_ratio < 0.60:
                score += 5
        else:
            score += 6

        if l.filler_word_ratio > 0.12:
            score += 10
        elif l.filler_word_ratio > 0.06:
            score += 5

        if a.f0_std_hz > 0 and a.f0_std_hz < 10:
            score += 5

        if duration < 15:
            score += 8
        elif duration < 25:
            score += 4

        return max(0.0, min(100.0, score))

    def _interpret(
        self,
        score: float,
        a: AcousticFeatures,
        l: LexicoSemanticFeatures,
    ) -> RiskInterpretation:
        if score < 25:
            risk_class = "Class 0 - Cognitively Normal"
            score_band = "c0"
            summary = "Speech biomarkers are mostly within expected healthy ranges."
            action = "Routine follow-up in 6-12 months."
        elif score < 45:
            risk_class = "Class 1 - Subjective Cognitive Decline"
            score_band = "c1"
            summary = "Mild speech biomarker deviations suggest possible early cognitive changes."
            action = "Repeat speech assessment in 2-3 months and track trend."
        elif score < 65:
            risk_class = "Class 2 - Mild Cognitive Impairment"
            score_band = "c2"
            summary = "Multiple speech biomarkers indicate probable mild cognitive impairment pattern."
            action = "Recommend neurologist or neuropsychology referral for detailed workup."
        else:
            risk_class = "Class 3 - High Risk - Urgent Referral"
            score_band = "c3"
            summary = "High-risk biomarker pattern across pauses, fluency, and speech dynamics."
            action = "Urgent specialist referral is recommended."

        flags = []
        if a.pause_ratio > 0.35:
            flags.append(f"High pause ratio ({a.pause_ratio:.1%})")
        if a.speech_rate_syllables_per_min and a.speech_rate_syllables_per_min < 180:
            flags.append(
                f"Slow speech rate ({a.speech_rate_syllables_per_min:.0f} syllables/min)"
            )
        if l.type_token_ratio < 0.50 and l.word_count >= 20:
            flags.append(f"Reduced lexical diversity (TTR={l.type_token_ratio:.2f})")
        if l.filler_word_ratio > 0.06:
            flags.append(f"Increased filler-word ratio ({l.filler_word_ratio:.1%})")
        if not flags:
            flags.append("No major red flags in this sample.")

        return RiskInterpretation(
            risk_class=risk_class,
            score_band=score_band,
            clinical_summary=summary,
            recommended_action=action,
            key_flags=flags,
        )

    def generate_demo_result(self) -> SpeechAnalysisResult:
        duration = round(random.uniform(35, 75), 2)
        pause_ratio = round(random.uniform(0.24, 0.56), 5)
        speech_rate = round(random.uniform(130, 230), 2)
        f0_std = round(random.uniform(7, 28), 3)

        acoustic = AcousticFeatures(
            mfcc_means=[round(random.uniform(-110, 55), 4) for _ in range(13)],
            spectral_centroid_hz=round(random.uniform(1200, 2600), 2),
            spectral_rolloff_hz=round(random.uniform(2800, 5800), 2),
            spectral_bandwidth_hz=round(random.uniform(1200, 2600), 2),
            zero_crossing_rate=round(random.uniform(0.03, 0.12), 6),
            vocal_energy_mean=round(random.uniform(0.01, 0.08), 6),
            vocal_energy_std=round(random.uniform(0.005, 0.02), 6),
            pause_count=random.randint(7, 20),
            pause_ratio=pause_ratio,
            mean_pause_duration_ms=round(random.uniform(220, 850), 2),
            total_silence_ratio=round(random.uniform(0.18, 0.48), 5),
            f0_mean_hz=round(random.uniform(105, 195), 3),
            f0_std_hz=f0_std,
            f0_range_hz=round(random.uniform(38, 160), 3),
            jitter=0.0,
            shimmer=0.0,
            hnr_db=0.0,
            speech_rate_syllables_per_min=speech_rate,
            formant_f1_hz=0.0,
            formant_f2_hz=0.0,
        )

        lexico = LexicoSemanticFeatures(
            transcript="the boy is reaching for the cookie while the sink overflows and mother is drying dishes",
            detected_language="en",
            word_count=17,
            unique_word_count=15,
            type_token_ratio=0.8824,
            guiraud_r=3.6401,
            mean_word_length=4.3529,
            filler_word_count=1,
            filler_word_ratio=0.0588,
            repetition_ratio=0.0,
            hapax_ratio=0.9333,
        )

        score = self._score(acoustic, lexico, duration)
        interpretation = self._interpret(score, acoustic, lexico)

        return SpeechAnalysisResult(
            duration_seconds=duration,
            acoustic=acoustic,
            lexico_semantic=lexico,
            risk_score=round(score, 1),
            risk_class=interpretation.risk_class,
            interpretation=interpretation,
            model_used="CogniSense Speech v1 (demo)",
            wav2vec_available=self.model_loaded,
        )

    @staticmethod
    def _normalize_language_code(code: str | None) -> str:
        if not code:
            return "unknown"
        value = str(code).strip().lower()
        if not value:
            return "unknown"
        if value in {"auto", "unknown"}:
            return value
        if value.startswith("<|") and value.endswith("|>"):
            value = value[2:-2]
        if "-" in value:
            value = value.split("-", 1)[0]

        aliases = {
            "eng": "en",
            "english": "en",
            "hin": "hi",
            "hindi": "hi",
            "mar": "mr",
            "marathi": "mr",
            "ben": "bn",
            "bengali": "bn",
            "tam": "ta",
            "tamil": "ta",
            "tel": "te",
            "telugu": "te",
            "guj": "gu",
            "gujarati": "gu",
            "kan": "kn",
            "kannada": "kn",
            "mal": "ml",
            "malayalam": "ml",
            "pan": "pa",
            "punjabi": "pa",
        }
        return aliases.get(value, value)

    def _detect_language_from_text(self, text: str) -> str:
        normalized = (text or "").strip()
        if not normalized:
            return "en"

        if LANGDETECT_OK:
            try:
                detected = detect_language(normalized)
                return self._normalize_language_code(detected)
            except Exception:
                pass

        # Script-based fallback when langdetect is unavailable.
        if re.search(r"[\u0900-\u097F]", normalized):
            marathi_markers = {"आहे", "आणि", "म्हणजे", "काय", "मध्ये"}
            lower_text = normalized.lower()
            if any(token in lower_text for token in marathi_markers):
                return "mr"
            return "hi"

        if re.search(r"[a-zA-Z]", normalized):
            return "en"

        return "en"

    def _transcribe_audio(
        self,
        asr_array: np.ndarray,
        sample_rate: int,
        language_code: str,
        strict: bool = False,
    ) -> dict:
        generate_kwargs = {}

        normalized_language = self._normalize_language_code(language_code)
        if normalized_language not in ("auto", "unknown"):
            whisper_language = WHISPER_LANGUAGE_TOKEN_BY_CODE.get(
                normalized_language,
                normalized_language,
            )
            generate_kwargs["language"] = whisper_language
            generate_kwargs["temperature"] = 0.0

        if strict:
            generate_kwargs["temperature"] = 0.0
            generate_kwargs["condition_on_prev_tokens"] = True
            generate_kwargs["no_repeat_ngram_size"] = 2
            generate_kwargs["num_beams"] = 2

        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message=r"The input name `inputs` is deprecated.*",
                category=FutureWarning,
            )
            warnings.filterwarnings(
                "ignore",
                message=r"The attention mask is not set.*",
            )
            return self.asr_pipeline(
                {"array": asr_array, "sampling_rate": sample_rate},
                return_timestamps=False,
                generate_kwargs=generate_kwargs,
            )

    def _prepare_asr_audio(self, y: np.ndarray, sample_rate: int) -> np.ndarray:
        asr_array = y.astype(np.float32)
        if asr_array.size == 0:
            return asr_array

        asr_array = asr_array - float(np.mean(asr_array))
        abs_signal = np.abs(asr_array)
        threshold = max(0.008, float(np.percentile(abs_signal, 65) * 0.25))
        speech_indices = np.where(abs_signal > threshold)[0]

        if speech_indices.size > 0:
            pad = int(0.2 * sample_rate)
            start = max(0, int(speech_indices[0]) - pad)
            end = min(asr_array.size, int(speech_indices[-1]) + pad + 1)
            if end - start > int(0.5 * sample_rate):
                asr_array = asr_array[start:end]

        max_samples = int(self.asr_max_audio_seconds * sample_rate)
        if max_samples > 0 and asr_array.size > max_samples:
            asr_array = asr_array[:max_samples]

        peak = float(np.max(np.abs(asr_array))) if asr_array.size > 0 else 0.0
        if peak > 0:
            asr_array = asr_array / peak

        rms = float(np.sqrt(np.mean(asr_array**2)) + 1e-9)
        gain = min(3.5, 0.06 / rms) if rms > 0 else 1.0
        asr_array = np.clip(asr_array * gain, -1.0, 1.0)
        return asr_array.astype(np.float32)

    def _choose_better_transcript(
        self,
        primary_text: str,
        candidate_text: str,
        language_code: str,
    ) -> str:
        primary = (primary_text or "").strip()
        candidate = (candidate_text or "").strip()

        if not candidate:
            return primary
        if not primary:
            return candidate

        primary_low = self._is_low_information_transcript(primary)
        candidate_low = self._is_low_information_transcript(candidate)
        if primary_low and not candidate_low:
            return candidate

        primary_mismatch = self._script_mismatch(primary, language_code)
        candidate_mismatch = self._script_mismatch(candidate, language_code)
        if primary_mismatch and not candidate_mismatch:
            return candidate

        primary_letters = len(re.findall(r"[A-Za-z\u0900-\u0D7F]", primary))
        candidate_letters = len(re.findall(r"[A-Za-z\u0900-\u0D7F]", candidate))
        if not candidate_low and not candidate_mismatch and candidate_letters >= primary_letters + 6:
            return candidate

        return primary

    def _get_forced_decoder_ids(self, language_code: str):
        tokenizer = getattr(self.asr_pipeline, "tokenizer", None)
        if tokenizer is None:
            return None
        try:
            if hasattr(tokenizer, "get_decoder_prompt_ids"):
                ids = tokenizer.get_decoder_prompt_ids(language=language_code, task="transcribe")
                return ids if ids else None
        except Exception:
            return None
        return None

    def _is_low_information_transcript(self, text: str) -> bool:
        normalized = (text or "").strip()
        if not normalized:
            return True

        if re.fullmatch(r"(?:\d+[-\s]*){8,}", normalized):
            return True

        letters = re.findall(r"[A-Za-z\u0900-\u0D7F]", normalized)
        digits = re.findall(r"\d", normalized)
        if len(letters) < 3 and len(digits) >= 8:
            return True

        if len(letters) >= 8:
            return False

        tokens = [t for t in re.findall(r"\w+", normalized.lower(), flags=re.UNICODE) if t]
        if len(tokens) >= 3 and any(re.search(r"[A-Za-z\u0900-\u0D7F]", t) for t in tokens):
            return False

        if len(tokens) <= 2 and len(normalized) > 30:
            return True

        return False

    def _localized_low_confidence_message(self, language_code: str) -> str:
        code = self._normalize_language_code(language_code)
        return LOW_CONFIDENCE_MESSAGE_BY_LANG.get(code, LOW_CONFIDENCE_MESSAGE_BY_LANG["en"])

    def _script_mismatch(self, text: str, language_code: str) -> bool:
        code = self._normalize_language_code(language_code)
        if code in ("auto", "unknown"):
            return False

        expected_script = SCRIPT_REGEX_BY_LANG.get(code)
        if not expected_script:
            return False

        normalized = (text or "").strip()
        if not normalized:
            return True

        all_letters = re.findall(r"[A-Za-z\u0900-\u0D7F]", normalized)
        if len(all_letters) < 12:
            return False

        matched = re.findall(expected_script, normalized)
        return (len(matched) / len(all_letters)) < 0.15

    @staticmethod
    def _empty_acoustic() -> AcousticFeatures:
        return AcousticFeatures(
            mfcc_means=[0.0] * 13,
            spectral_centroid_hz=0.0,
            spectral_rolloff_hz=0.0,
            spectral_bandwidth_hz=0.0,
            zero_crossing_rate=0.0,
            vocal_energy_mean=0.0,
            vocal_energy_std=0.0,
            pause_count=0,
            pause_ratio=0.0,
            mean_pause_duration_ms=0.0,
            total_silence_ratio=0.0,
            f0_mean_hz=0.0,
            f0_std_hz=0.0,
            f0_range_hz=0.0,
            jitter=0.0,
            shimmer=0.0,
            hnr_db=0.0,
            speech_rate_syllables_per_min=0.0,
            formant_f1_hz=0.0,
            formant_f2_hz=0.0,
        )


_ANALYZER: Optional[SpeechAnalyzer] = None


def get_speech_analyzer() -> SpeechAnalyzer:
    global _ANALYZER
    if _ANALYZER is None:
        _ANALYZER = SpeechAnalyzer()
    return _ANALYZER
