"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 BiomarkerEngine - Clinical biomarker calculations
================================================================================
"""

import math
from typing import List, Tuple
import numpy as np
from ..config import SACCADE_VELOCITY_DEG_S, CAMERA_FOV_DEG, ERROR_WINDOW_MS
from ..data.data_containers import GazePoint


class BiomarkerEngine:
    """
    All clinical biomarker maths.

    Designed to operate on a list[GazePoint] for one trial.
    """

    # ── velocity ──────────────────────────────────────────────────────────
    @staticmethod
    def angular_velocity(p1: GazePoint, p2: GazePoint,
                         fov_deg: float = CAMERA_FOV_DEG) -> float:
        """
        Approximate angular velocity in °/s between two gaze points.

        norm_x spans ≈ ±1 across the screen; screen subtends fov_deg
        horizontally at a normal viewing distance.
        Delta in norm units × fov_deg/2 → degrees of visual angle.
        Divide by elapsed time → °/s.
        """
        dt = p2.timestamp_s - p1.timestamp_s
        if dt <= 0:
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
        """
        Scan a sequence of GazePoints for saccade events.

        Returns list of (frame_index, velocity_deg_s, direction)
        where direction is 'left' or 'right'.
        """
        events = []
        for i in range(1, len(points)):
            v = cls.angular_velocity(points[i - 1], points[i])
            if v > threshold:
                direction = "right" if points[i].norm_x > points[i - 1].norm_x \
                            else "left"
                events.append((i, v, direction))
        return events

    # ── antisaccade error ─────────────────────────────────────────────────
    @classmethod
    def classify_trial(cls, stim_onset_s: float,
                       stimulus_side: str,
                       points: List[GazePoint],
                       error_window_ms: float = ERROR_WINDOW_MS
                       ) -> Tuple[bool, float, float]:
        """
        Returns (is_error, latency_ms, first_saccade_velocity).

        Logic
        ─────
        1. Collect all saccades within `error_window_ms` after stim onset.
        2. If the FIRST saccade is TOWARD the stimulus  → error.
        3. Latency = time from stim onset to first CORRECT saccade.
        """
        error_window_s   = error_window_ms / 1000.0
        correct_side     = "left" if stimulus_side == "right" else "right"

        stim_points = [p for p in points if p.timestamp_s >= stim_onset_s]
        saccades    = cls.detect_saccades(stim_points)

        if not saccades:
            # No saccade detected ─ count as error (no response)
            return True, float("nan"), 0.0

        first_idx, first_vel, first_dir = saccades[0]
        t_first = stim_points[first_idx].timestamp_s

        is_error = first_dir == stimulus_side   # moved TOWARD dot = error

        # Find first correct saccade for latency
        latency_ms = float("nan")
        for idx, vel, direction in saccades:
            if direction == correct_side:
                latency_ms = (stim_points[idx].timestamp_s - stim_onset_s) * 1000
                break

        return is_error, latency_ms, first_vel

    # ── fixation stability ────────────────────────────────────────────────
    @staticmethod
    def fixation_rmsd(points: List[GazePoint]) -> float:
        """
        Root Mean Square Deviation of (norm_x, norm_y) over the
        fixation window — measures how steady gaze is on the cross.
        """
        if len(points) < 2:
            return float("nan")
        xs = np.array([p.norm_x for p in points])
        ys = np.array([p.norm_y for p in points])
        rmsd_x = np.sqrt(np.mean((xs - xs.mean()) ** 2))
        rmsd_y = np.sqrt(np.mean((ys - ys.mean()) ** 2))
        return float(math.hypot(rmsd_x, rmsd_y))

    # ── smooth pursuit gain ───────────────────────────────────────────────
    @staticmethod
    def pursuit_gain(eye_velocities: List[float],
                     target_velocities: List[float]) -> float:
        """
        Gaze gain = mean(|eye_vel|) / mean(|target_vel|).
        Healthy adults: ≈ 0.9–1.0; AD patients often show < 0.7.
        """
        ev = np.array(eye_velocities)
        tv = np.array(target_velocities)
        if tv.mean() < 1e-6:
            return float("nan")
        return float(np.abs(ev).mean() / np.abs(tv).mean())