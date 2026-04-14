"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 DataArchive - CSV writer for raw gaze data
================================================================================
"""

import csv
from dataclasses import asdict
from pathlib import Path
from typing import List
from .data_containers import GazePoint


class DataArchive:
    """Persists raw gaze data to CSV files."""

    @staticmethod
    def save_raw(points: List[GazePoint], path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        fields = ["timestamp_s", "trial_id", "phase", "stimulus_side",
                  "norm_x", "norm_y", "raw_lx", "raw_ly", "face_detected"]
        with open(path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for p in points:
                w.writerow(asdict(p))
        print(f"[INFO] Raw gaze data  → {path}  ({len(points)} rows)")

    @staticmethod
    def save_antisaccade(points: List[GazePoint], path: Path):
        """Legacy format matching original CogniSense spec."""
        path.parent.mkdir(parents=True, exist_ok=True)
        fields = ["timestamp", "trial_id", "stimulus_side",
                  "norm_iris_x", "norm_iris_y"]
        with open(path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for p in points:
                if p.phase in ("fixation", "stimulus"):
                    w.writerow({
                        "timestamp"     : p.timestamp_s,
                        "trial_id"      : p.trial_id,
                        "stimulus_side" : p.stimulus_side,
                        "norm_iris_x"   : p.norm_x,
                        "norm_iris_y"   : p.norm_y,
                    })
        print(f"[INFO] Antisaccade CSV → {path}")