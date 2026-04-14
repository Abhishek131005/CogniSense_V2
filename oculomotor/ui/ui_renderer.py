"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 UIRenderer - OpenCV drawing helpers
================================================================================
"""

import cv2
import numpy as np
from ..config import COL_BG, COL_CROSS, COL_STIMULUS, COL_PURSUIT_DOT, COL_TEXT, COL_GOOD

FONT = cv2.FONT_HERSHEY_SIMPLEX


class UIRenderer:
    """Stateless collection of OpenCV drawing helpers."""

    @staticmethod
    def blank(w: int, h: int) -> np.ndarray:
        return np.full((h, w, 3), COL_BG, dtype=np.uint8)

    @staticmethod
    def fixation_cross(canvas: np.ndarray, cx: int, cy: int,
                       size: int = 30, thickness: int = 3):
        cv2.line(canvas, (cx - size, cy), (cx + size, cy), COL_CROSS, thickness)
        cv2.line(canvas, (cx, cy - size), (cx, cy + size), COL_CROSS, thickness)

    @staticmethod
    def stimulus_dot(canvas: np.ndarray, x: int, y: int, radius: int = 20):
        cv2.circle(canvas, (x, y), radius, COL_STIMULUS, -1)

    @staticmethod
    def pursuit_dot(canvas: np.ndarray, x: int, y: int, radius: int = 18):
        cv2.circle(canvas, (x, y), radius, COL_PURSUIT_DOT, -1)

    @staticmethod
    def status_bar(canvas: np.ndarray, text: str,
                   colour=COL_TEXT, y_frac: float = 0.05):
        h, w = canvas.shape[:2]
        y    = int(h * y_frac)
        cv2.putText(canvas, text, (20, y), FONT, 0.65, colour, 2, cv2.LINE_AA)

    @staticmethod
    def progress_bar(canvas: np.ndarray, current: int, total: int):
        h, w = canvas.shape[:2]
        bar_w = int(w * 0.5)
        bar_h = 8
        bx    = (w - bar_w) // 2
        by    = h - 30
        cv2.rectangle(canvas, (bx, by), (bx + bar_w, by + bar_h),
                      (60, 60, 60), -1)
        filled = int(bar_w * current / max(total, 1))
        cv2.rectangle(canvas, (bx, by), (bx + filled, by + bar_h),
                      COL_GOOD, -1)
        label = f"Trial {current}/{total}"
        cv2.putText(canvas, label, (bx + bar_w + 10, by + bar_h),
                    FONT, 0.5, COL_TEXT, 1, cv2.LINE_AA)

    @staticmethod
    def gaze_dot(canvas: np.ndarray, nx: float, ny: float,
                 radius: int = 8):
        """Draw a small cyan dot representing current gaze on the overlay."""
        h, w = canvas.shape[:2]
        # nx ∈ [-1,1] → pixel x;  ny ∈ [-1,1] → pixel y
        px = int((nx * 0.4 + 0.5) * w)
        py = int((ny * 0.4 + 0.5) * h)
        px = max(radius, min(w - radius, px))
        py = max(radius, min(h - radius, py))
        cv2.circle(canvas, (px, py), radius, (255, 255, 0), -1)