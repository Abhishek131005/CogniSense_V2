"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 CalibrationEngine - Personal baseline calibration
================================================================================
"""

import json
from typing import Tuple
import numpy as np
from ..config import CALIBRATION_LOG


class CalibrationEngine:
    """
    5-second neutral-gaze calibration step.

    The patient looks at a central fixation point.
    We record the mean norm_x and norm_y to establish their personal
    straight-ahead baseline, then subtract it from all future readings.
    """

    def __init__(self):
        self.baseline_x : float = 0.0
        self.baseline_y : float = 0.0
        self.calibrated : bool  = False
        self._samples_x : list  = []
        self._samples_y : list  = []

    def add_sample(self, nx: float, ny: float):
        self._samples_x.append(nx)
        self._samples_y.append(ny)

    def finalise(self):
        if len(self._samples_x) > 5:
            self.baseline_x = float(np.median(self._samples_x))
            self.baseline_y = float(np.median(self._samples_y))
            self.calibrated = True
        else:
            print("[WARN] Calibration: insufficient samples; using 0 baseline.")
            self.baseline_x = self.baseline_y = 0.0
            self.calibrated = True

    def correct(self, nx: float, ny: float) -> Tuple[float, float]:
        """Apply baseline correction to a raw normalised coordinate."""
        return nx - self.baseline_x, ny - self.baseline_y

    def save(self):
        data = {"baseline_x": self.baseline_x,
                "baseline_y": self.baseline_y,
                "n_samples"  : len(self._samples_x)}
        with open(CALIBRATION_LOG, "w") as f:
            json.dump(data, f, indent=2)
        print(f"[INFO] Calibration saved → {CALIBRATION_LOG}")