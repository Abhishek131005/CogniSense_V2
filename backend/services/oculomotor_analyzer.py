"""
backend/services/oculomotor_analyzer.py

Integrated oculomotor analyzer that bridges the standalone oculomotor package
with the unified backend API.
"""

from __future__ import annotations

import json
import math
import os
import random
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from utils.oculomotor_models import (
    OculomotorAnalysisResponse,
    OculomotorMetrics,
    OculomotorMetricsSummary,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Try reusing thresholds from the standalone oculomotor package.
try:
    from oculomotor.config import ERROR_WINDOW_MS, SACCADE_VELOCITY_DEG_S

    OCULOMOTOR_PACKAGE_AVAILABLE = True
except Exception:
    ERROR_WINDOW_MS = 500
    SACCADE_VELOCITY_DEG_S = 30.0
    OCULOMOTOR_PACKAGE_AVAILABLE = False


RISK_LABELS = [
    "Cognitively Normal",
    "Subjective Cognitive Decline",
    "Mild Cognitive Impairment",
    "High Risk - Urgent Referral",
]


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _score_to_class(score: float) -> int:
    if score < 25:
        return 0
    if score < 45:
        return 1
    if score < 65:
        return 2
    return 3


def _clinical_risk_from_points(points: int) -> str:
    if points >= 5:
        return "High"
    if points >= 3:
        return "Medium"
    return "Low"


def _recommendation_for_class(risk_class: int) -> str:
    if risk_class == 0:
        return "Oculomotor biomarkers are within expected range. Continue routine follow-up."
    if risk_class == 1:
        return "Mild oculomotor changes detected. Repeat assessment in 2-3 months and track trajectory."
    if risk_class == 2:
        return "Moderate oculomotor abnormalities detected. Recommend detailed neurocognitive evaluation."
    return "High-risk oculomotor profile. Recommend urgent specialist referral and multimodal follow-up."


class OculomotorAnalyzer:
    """Risk fusion analyzer for oculomotor metrics."""

    def __init__(self) -> None:
        self._report_path = REPO_ROOT / "oculomotor_output" / "oculomotor_report.json"
        self._oculomotor_root = REPO_ROOT / "oculomotor"
        configured_python = os.getenv("COGNISENSE_OCULOMOTOR_PYTHON", "").strip()
        self._python_candidates: list[Path] = []

        if configured_python:
            self._python_candidates.append(Path(configured_python))

        # Prefer the project-local Python 3.10 venv for camera task compatibility.
        self._python_candidates.extend(
            [
                REPO_ROOT / "backend" / "venv310" / "Scripts" / "python.exe",
                Path(sys.executable),
                REPO_ROOT / ".venv" / "Scripts" / "python.exe",
            ]
        )

    def health_status(self) -> dict[str, Any]:
        python_exec = self._resolve_python_executable()
        return {
            "status": "ok",
            "module": "oculomotor",
            "backend_mode": "integrated-metrics-fusion",
            "oculomotor_package_available": OCULOMOTOR_PACKAGE_AVAILABLE,
            "latest_pipeline_report_available": self._report_path.exists(),
            "pipeline_launch_supported": self._oculomotor_root.exists() and python_exec is not None,
            "python_executable": str(python_exec) if python_exec is not None else None,
            "thresholds": {
                "error_window_ms": ERROR_WINDOW_MS,
                "saccade_velocity_deg_s": SACCADE_VELOCITY_DEG_S,
            },
        }

    def run_standalone_task(self, *, timeout_seconds: int = 420) -> dict[str, Any]:
        if not self._oculomotor_root.exists():
            raise FileNotFoundError("Standalone oculomotor module not found in workspace.")

        python_exec = self._resolve_python_executable()
        if python_exec is None:
            raise RuntimeError("No Python executable available to launch oculomotor task.")

        timeout_seconds = max(120, min(int(timeout_seconds), 1800))

        previous_mtime = self._report_path.stat().st_mtime if self._report_path.exists() else None
        command = [str(python_exec), "-m", "oculomotor.main"]

        env = os.environ.copy()
        env.setdefault("PYTHONUNBUFFERED", "1")
        env.setdefault("PYTHONUTF8", "1")
        env.setdefault("PYTHONIOENCODING", "utf-8")

        started_at = time.time()
        try:
            completed = subprocess.run(
                command,
                cwd=str(REPO_ROOT),
                env=env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
            )
            elapsed = round(time.time() - started_at, 2)

            stdout_tail = self._tail_lines(completed.stdout)
            stderr_tail = self._tail_lines(completed.stderr)

            report_available = self._report_path.exists()
            report_updated = self._is_report_updated(previous_mtime)

            if completed.returncode == 0:
                if report_available:
                    message = "Camera task completed. Latest oculomotor report is ready."
                else:
                    message = "Camera task completed but no report file was found."
                return {
                    "status": "completed",
                    "message": message,
                    "elapsed_seconds": elapsed,
                    "report_available": report_available,
                    "report_updated": report_updated,
                    "stdout_tail": stdout_tail,
                    "stderr_tail": stderr_tail,
                }

            return {
                "status": "failed",
                "message": f"Camera task exited with code {completed.returncode}.",
                "elapsed_seconds": elapsed,
                "report_available": report_available,
                "report_updated": report_updated,
                "stdout_tail": stdout_tail,
                "stderr_tail": stderr_tail,
            }

        except subprocess.TimeoutExpired as exc:
            elapsed = round(time.time() - started_at, 2)
            stdout_tail = self._tail_lines(exc.stdout)
            stderr_tail = self._tail_lines(exc.stderr)

            return {
                "status": "timed_out",
                "message": f"Camera task timed out after {timeout_seconds} seconds.",
                "elapsed_seconds": elapsed,
                "report_available": self._report_path.exists(),
                "report_updated": self._is_report_updated(previous_mtime),
                "stdout_tail": stdout_tail,
                "stderr_tail": stderr_tail,
            }

    def analyze_metrics(
        self,
        metrics: OculomotorMetrics,
        *,
        source: str = "manual",
        report_payload: dict | None = None,
    ) -> OculomotorAnalysisResponse:
        trial_count = max(1, int(metrics.trial_count))
        error_count = max(0, min(int(metrics.antisaccade_errors), trial_count))
        error_rate = (error_count / trial_count) * 100.0

        avg_latency = float(metrics.avg_latency_ms)
        fixation_rmsd = float(metrics.fixation_rmsd)
        pursuit_gain = metrics.pursuit_gain

        # Continuous score for UX trend chart (0-100)
        error_component = _clamp(error_rate / 60.0, 0.0, 1.0)
        latency_component = _clamp((avg_latency - 180.0) / 240.0, 0.0, 1.0)
        stability_component = _clamp(fixation_rmsd / 0.20, 0.0, 1.0)

        if pursuit_gain is None:
            pursuit_component = 0.35
        else:
            pursuit_component = _clamp((1.0 - float(pursuit_gain)) / 0.5, 0.0, 1.0)

        risk_score = (
            error_component * 45.0
            + latency_component * 25.0
            + stability_component * 15.0
            + pursuit_component * 15.0
        )
        risk_score = round(_clamp(risk_score, 0.0, 100.0), 1)

        # Clinical risk rule set from standalone report logic.
        risk_points = 0
        if error_rate > 40:
            risk_points += 2
        elif error_rate > 20:
            risk_points += 1

        if avg_latency > 350:
            risk_points += 2
        elif avg_latency > 250:
            risk_points += 1

        if fixation_rmsd > 0.12:
            risk_points += 1

        if pursuit_gain is not None:
            if pursuit_gain < 0.7:
                risk_points += 2
            elif pursuit_gain < 0.85:
                risk_points += 1

        clinical_risk = _clinical_risk_from_points(risk_points)

        risk_class = _score_to_class(risk_score)
        risk_label = RISK_LABELS[risk_class]

        flags: list[str] = []
        if error_rate > 40:
            flags.append(f"High antisaccade error rate ({error_rate:.1f}%).")
        elif error_rate > 20:
            flags.append(f"Moderate antisaccade error rate ({error_rate:.1f}%).")

        if avg_latency > 350:
            flags.append(f"Delayed corrective latency ({avg_latency:.0f} ms).")
        elif avg_latency > 250:
            flags.append(f"Latency above optimal range ({avg_latency:.0f} ms).")

        if fixation_rmsd > 0.12:
            flags.append(f"Reduced fixation stability (RMSD {fixation_rmsd:.4f}).")

        if pursuit_gain is not None:
            if pursuit_gain < 0.7:
                flags.append(f"Low smooth pursuit gain ({pursuit_gain:.3f}).")
            elif pursuit_gain < 0.85:
                flags.append(f"Suboptimal smooth pursuit gain ({pursuit_gain:.3f}).")
        else:
            flags.append("Smooth pursuit gain unavailable; computed from antisaccade-only metrics.")

        if not flags:
            flags.append("No major oculomotor red flags in this sample.")

        summary = OculomotorMetricsSummary(
            trial_count=trial_count,
            antisaccade_errors=error_count,
            error_rate_percent=round(error_rate, 2),
            avg_latency_ms=round(avg_latency, 2),
            fixation_rmsd=round(fixation_rmsd, 5),
            pursuit_gain=round(float(pursuit_gain), 4) if pursuit_gain is not None else None,
        )

        return OculomotorAnalysisResponse(
            risk_score=risk_score,
            risk_class=risk_class,
            risk_label=risk_label,
            clinical_risk=clinical_risk,
            flags=flags,
            recommendation=_recommendation_for_class(risk_class),
            metrics=summary,
            model_used="CogniSense Oculomotor v1 (rule-fusion)",
            backend_mode="integrated-metrics-fusion",
            breakdown={
                "source": source,
                "risk_points": risk_points,
                "components": {
                    "error_component": round(error_component, 4),
                    "latency_component": round(latency_component, 4),
                    "stability_component": round(stability_component, 4),
                    "pursuit_component": round(pursuit_component, 4),
                },
                "raw_report": report_payload,
            },
        )

    def generate_demo_result(self) -> OculomotorAnalysisResponse:
        trial_count = 20
        error_count = random.randint(2, 10)
        metrics = OculomotorMetrics(
            trial_count=trial_count,
            antisaccade_errors=error_count,
            avg_latency_ms=round(random.uniform(210.0, 390.0), 1),
            fixation_rmsd=round(random.uniform(0.05, 0.18), 4),
            pursuit_gain=round(random.uniform(0.62, 0.96), 3),
        )
        return self.analyze_metrics(metrics, source="demo")

    def analyze_latest_report(self) -> OculomotorAnalysisResponse:
        if not self._report_path.exists():
            raise FileNotFoundError("No oculomotor report found. Run the standalone oculomotor module first.")

        with open(self._report_path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        n_trials = int(payload.get("n_trials") or 20)
        n_errors = int(payload.get("n_errors") or 0)

        avg_latency = self._parse_number(payload.get("avg_latency_ms"), fallback=280.0)
        fixation_rmsd = self._parse_number(payload.get("stability_score"), fallback=0.08)
        pursuit_gain = self._parse_number(payload.get("pursuit_gain"), fallback=None)

        metrics = OculomotorMetrics(
            trial_count=n_trials,
            antisaccade_errors=n_errors,
            avg_latency_ms=avg_latency,
            fixation_rmsd=fixation_rmsd,
            pursuit_gain=pursuit_gain,
        )
        return self.analyze_metrics(metrics, source="pipeline-report", report_payload=payload)

    @staticmethod
    def _parse_number(value: Any, fallback: float | None) -> float | None:
        if value is None:
            return fallback

        if isinstance(value, (int, float)):
            parsed = float(value)
            if math.isfinite(parsed):
                return parsed
            return fallback

        text = str(value).strip()
        if not text or text.upper() == "N/A":
            return fallback

        if text.endswith("%"):
            text = text[:-1]

        try:
            parsed = float(text)
            if math.isfinite(parsed):
                return parsed
        except Exception:
            pass

        return fallback

    def _resolve_python_executable(self) -> Path | None:
        for candidate in self._python_candidates:
            if candidate and candidate.exists():
                return candidate
        return None

    def _is_report_updated(self, previous_mtime: float | None) -> bool:
        if not self._report_path.exists():
            return False

        if previous_mtime is None:
            return True

        try:
            return self._report_path.stat().st_mtime > previous_mtime
        except Exception:
            return False

    @staticmethod
    def _tail_lines(text: str | bytes | None, *, limit: int = 40) -> list[str]:
        if text is None:
            return []

        if isinstance(text, bytes):
            normalized = text.decode("utf-8", errors="replace")
        else:
            normalized = str(text)

        lines = [line.rstrip() for line in normalized.splitlines() if line.strip()]
        if not lines:
            return []

        return lines[-limit:]


_ANALYZER: OculomotorAnalyzer | None = None


def get_oculomotor_analyzer() -> OculomotorAnalyzer:
    global _ANALYZER
    if _ANALYZER is None:
        _ANALYZER = OculomotorAnalyzer()
    return _ANALYZER
