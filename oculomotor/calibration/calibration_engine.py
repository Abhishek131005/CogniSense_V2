"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 CalibrationEngine — personal baseline calibration
================================================================================
"""

import json
from typing import Tuple
import numpy as np
from ..config import CALIBRATION_LOG


class CalibrationEngine:
    """Neutral-gaze calibration: records baseline offset + head centre."""

    def __init__(self):
        self.baseline_x : float = 0.0
        self.baseline_y : float = 0.0
        self.head_ref_x : float = 0.5
        self.head_ref_y : float = 0.5
        self.calibrated : bool  = False
        self._samples_x : list  = []
        self._samples_y : list  = []
        self._head_x    : list  = []
        self._head_y    : list  = []

    def add_sample(self, nx: float, ny: float,
                   hx: float = float("nan"), hy: float = float("nan")):
        self._samples_x.append(nx)
        self._samples_y.append(ny)
        if not np.isnan(hx):
            self._head_x.append(hx)
            self._head_y.append(hy)

    def finalise(self):
        if len(self._samples_x) > 5:
            self.baseline_x = float(np.median(self._samples_x))
            self.baseline_y = float(np.median(self._samples_y))
            if self._head_x:
                self.head_ref_x = float(np.median(self._head_x))
                self.head_ref_y = float(np.median(self._head_y))
            self.calibrated = True
        else:
            print("[WARN] Calibration: insufficient samples; using 0 baseline.")
            self.baseline_x = self.baseline_y = 0.0
            self.calibrated = True

    def correct(self, nx: float, ny: float) -> Tuple[float, float]:
        return nx - self.baseline_x, ny - self.baseline_y

    def save(self):
        data = {
            "baseline_x": self.baseline_x,
            "baseline_y": self.baseline_y,
            "head_ref_x": self.head_ref_x,
            "head_ref_y": self.head_ref_y,
            "n_samples" : len(self._samples_x),
        }
        with open(CALIBRATION_LOG, "w") as f:
            json.dump(data, f, indent=2)
        print(f"[INFO] Calibration saved → {CALIBRATION_LOG}")