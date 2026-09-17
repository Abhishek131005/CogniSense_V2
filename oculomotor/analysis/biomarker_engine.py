"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 BiomarkerEngine — clinical biomarker calculations + scoring
================================================================================
"""

import math
from typing import List, Tuple
import numpy as np
from ..config import SACCADE_VELOCITY_DEG_S, CAMERA_FOV_DEG, ERROR_WINDOW_MS
from ..data.data_containers import GazePoint


class BiomarkerEngine:

    # ── velocity ──────────────────────────────────────────────────────────
    @staticmethod
    def angular_velocity(p1: GazePoint, p2: GazePoint,
                         fov_deg: float = CAMERA_FOV_DEG) -> float:
        dt = p2.timestamp_s - p1.timestamp_s
        if dt <= 0:
            return 0.0

        # Skip frames with missing gaze — otherwise NaN poisons everything
        if (math.isnan(p1.norm_x) or math.isnan(p1.norm_y) or
                math.isnan(p2.norm_x) or math.isnan(p2.norm_y)):
            return 0.0

        dx_deg = (p2.norm_x - p1.norm_x) * (fov_deg / 2.0)
        dy_deg = (p2.norm_y - p1.norm_y) * (fov_deg / 2.0)
        dist   = math.hypot(dx_deg, dy_deg)
        return dist / dt

    # ── saccade detection ─────────────────────────────────────────────────
    @classmethod
    def detect_saccades(cls, points: List[GazePoint],
                        threshold: float = SACCADE_VELOCITY_DEG_S
                        ) -> List[Tuple[int, float, str]]:
        events = []
        for i in range(1, len(points)):
            v = cls.angular_velocity(points[i - 1], points[i])
            if v > threshold:
                direction = ("right" if points[i].norm_x > points[i - 1].norm_x
                             else "left")
                events.append((i, v, direction))
        return events

    # ── antisaccade error ─────────────────────────────────────────────────
    @classmethod
    def classify_trial(cls, stim_onset_s: float,
                       stimulus_side: str,
                       points: List[GazePoint],
                       error_window_ms: float = ERROR_WINDOW_MS
                       ) -> Tuple[bool, float, float, str, str]:
        """
        Returns (is_error, latency_ms, first_saccade_velocity,
                 first_saccade_dir, response_label).

        response_label ∈ {"correct", "error", "no_response"}
        """
        error_window_s = error_window_ms / 1000.0
        correct_side   = "left" if stimulus_side == "right" else "right"

        stim_points = [p for p in points if p.timestamp_s >= stim_onset_s]
        saccades    = cls.detect_saccades(stim_points)

        if not saccades:
            return True, float("nan"), 0.0, "none", "no_response"

        # Only consider saccades inside the error window for the *first* one
        first_idx, first_vel, first_dir = saccades[0]
        t_first = stim_points[first_idx].timestamp_s - stim_onset_s
        if t_first > error_window_s:
            # First saccade too late — treat as no response.
            return True, float("nan"), first_vel, first_dir, "no_response"

        is_error = (first_dir == stimulus_side)
        response_label = "error" if is_error else "correct"

        # latency = time to first CORRECT saccade
        latency_ms = float("nan")
        for idx, _vel, direction in saccades:
            if direction == correct_side:
                latency_ms = (stim_points[idx].timestamp_s - stim_onset_s) * 1000.0
                break

        return is_error, latency_ms, first_vel, first_dir, response_label

    # ── fixation stability ────────────────────────────────────────────────
    @staticmethod
    def fixation_rmsd(points: List[GazePoint]) -> float:
        valid = [p for p in points
                 if not math.isnan(p.norm_x) and not math.isnan(p.norm_y)]
        if len(valid) < 2:
            return float("nan")
        xs = np.array([p.norm_x for p in valid])
        ys = np.array([p.norm_y for p in valid])
        rmsd_x = np.sqrt(np.mean((xs - xs.mean()) ** 2))
        rmsd_y = np.sqrt(np.mean((ys - ys.mean()) ** 2))
        return float(math.hypot(rmsd_x, rmsd_y))

    # ── smooth pursuit gain ───────────────────────────────────────────────
    @staticmethod
    def pursuit_gain(eye_velocities: List[float],
                     target_velocities: List[float]) -> float:
        ev = np.array(eye_velocities)
        tv = np.array(target_velocities)
        if tv.size == 0 or tv.mean() < 1e-6:
            return float("nan")
        return float(np.abs(ev).mean() / np.abs(tv).mean())

    # ── NEW: 0–100 score + 6-class label ──────────────────────────────────
    @staticmethod
    def score_and_classify(error_rate: float,
                           mean_latency_ms: float,
                           mean_rmsd: float,
                           pursuit_gain: float
                           ) -> Tuple[float, str, float]:
        """
        Combine biomarkers into:
          • score       ∈ [0, 100]  (higher = better / healthier)
          • class_label ∈ one of six bands
          • confidence  ∈ [0, 1]    (how far from the nearest class boundary)

        Sub-scores are each mapped to [0,1] (1 = healthy) then averaged.
        """
        # error rate: 0 % → 1.0 ; 60 % → 0.0
        if math.isnan(error_rate):
            s_err = 0.5
        else:
            s_err = max(0.0, min(1.0, 1.0 - (error_rate / 60.0)))

        # latency: 200 ms → 1.0 ; 600 ms → 0.0
        if math.isnan(mean_latency_ms):
            s_lat = 0.5
        else:
            s_lat = max(0.0, min(1.0, (600.0 - mean_latency_ms) / 400.0))

        # rmsd: 0.03 → 1.0 ; 0.25 → 0.0
        if math.isnan(mean_rmsd):
            s_rms = 0.5
        else:
            s_rms = max(0.0, min(1.0, (0.25 - mean_rmsd) / 0.22))

        # pursuit gain: 1.0 → 1.0 ; 0.5 → 0.0
        if math.isnan(pursuit_gain):
            s_pur = 0.5
        else:
            s_pur = max(0.0, min(1.0, (pursuit_gain - 0.5) / 0.5))

        score = 100.0 * (0.35 * s_err + 0.25 * s_lat +
                         0.15 * s_rms + 0.25 * s_pur)

        # Six clinically-meaningful bands
        if   score >= 85: label, lo, hi = "Optimal",          85, 100
        elif score >= 70: label, lo, hi = "Normal",           70, 85
        elif score >= 55: label, lo, hi = "Borderline",       55, 70
        elif score >= 40: label, lo, hi = "Mild Concern",     40, 55
        elif score >= 25: label, lo, hi = "Moderate Concern", 25, 40
        else:             label, lo, hi = "High Concern",     0,  25

        # Confidence: distance to nearest band edge, normalised
        edge = min(score - lo, hi - score)
        span = max(hi - lo, 1)
        conf = min(1.0, 0.5 + (edge / span) * 0.5)   # 0.5 … 1.0
        return float(score), label, float(conf)