"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 FaceMeshTracker - MediaPipe iris tracking wrapper
================================================================================
"""

from typing import List, Optional, Tuple
import cv2
import mediapipe as mp
import numpy as np

# Import from config
from ..config import (
    L_INNER_CORNER, L_OUTER_CORNER, R_INNER_CORNER, R_OUTER_CORNER,
    LIRS_INDICES_FULL, RIRS_INDICES_FULL
)


class FaceMeshTracker:
    """
    Wraps MediaPipe FaceMesh (478-landmark iris-refined model).

    Usage
    ─────
        tracker = FaceMeshTracker()
        with tracker:
            lm = tracker.process_frame(bgr_frame)
            if lm:
                gaze = tracker.extract_gaze(lm, frame_w, frame_h)
    """

    def __init__(self, max_faces: int = 1, min_detection_conf: float = 0.5,
                 min_tracking_conf: float = 0.5):
        self._mp_fm  = mp.solutions.face_mesh
        self._fm     = None
        self._max    = max_faces
        self._det_c  = min_detection_conf
        self._trk_c  = min_tracking_conf

    # ── context manager ────────────────────────────────────────────────────
    def __enter__(self):
        self._fm = self._mp_fm.FaceMesh(
            static_image_mode        = False,
            max_num_faces            = self._max,
            refine_landmarks         = True,      # REQUIRED for iris pts 468-477
            min_detection_confidence = self._det_c,
            min_tracking_confidence  = self._trk_c,
        )
        return self

    def __exit__(self, *_):
        if self._fm:
            self._fm.close()

    # ── processing ────────────────────────────────────────────────────────
    def process_frame(self, bgr: np.ndarray) -> Optional[list]:
        """
        Run MediaPipe on one BGR frame.
        Returns the landmark list for the first detected face, or None.
        """
        rgb     = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        results = self._fm.process(rgb)
        if results.multi_face_landmarks:
            return results.multi_face_landmarks[0].landmark
        return None

    # ── gaze extraction ───────────────────────────────────────────────────
    @staticmethod
    def iris_centroid(landmarks: list, indices: List[int],
                      w: int, h: int) -> Tuple[float, float]:
        """
        Average (x, y) pixel position of the specified landmark indices.
        MediaPipe returns normalised [0,1] coords; we convert to pixels.
        """
        xs = [landmarks[i].x * w for i in indices]
        ys = [landmarks[i].y * h for i in indices]
        return float(np.mean(xs)), float(np.mean(ys))

    @staticmethod
    def eye_width(landmarks: list, inner: int, outer: int, w: int) -> float:
        """Pixel width of one eye (inner corner to outer corner)."""
        x1 = landmarks[inner].x * w
        x2 = landmarks[outer].x * w
        return abs(x2 - x1) + 1e-6   # avoid /0

    @classmethod
    def extract_gaze(cls, landmarks: list, w: int, h: int
                     ) -> Tuple[float, float, float, float]:
        """
        Return head-pose-normalised gaze vector for both eyes averaged.

        Normalisation strategy
        ──────────────────────
        For each eye we compute:
            offset_x = (iris_centroid_x – inner_corner_x) / eye_width
        This makes the value ≈ 0 when looking straight ahead and
        ±0.5 at the extremes, independent of face scale or small
        head translations.

        Returns: (norm_x, norm_y, raw_lx, raw_ly)
        """
        # ── left eye ─────────────────────────────────────────────────────
        lcx, lcy   = cls.iris_centroid(landmarks, LIRS_INDICES_FULL, w, h)
        l_inner_x  = landmarks[L_INNER_CORNER].x * w
        l_outer_x  = landmarks[L_OUTER_CORNER].x * w
        l_inner_y  = landmarks[L_INNER_CORNER].y * h
        l_width    = abs(l_outer_x - l_inner_x) + 1e-6
        l_height   = l_width * 0.4   # approximate eye height from width

        l_norm_x   = (lcx - l_inner_x) / l_width - 0.5
        l_norm_y   = (lcy - l_inner_y) / l_height - 0.5

        # ── right eye ─────────────────────────────────────────────────────
        rcx, rcy   = cls.iris_centroid(landmarks, RIRS_INDICES_FULL, w, h)
        r_inner_x  = landmarks[R_INNER_CORNER].x * w
        r_outer_x  = landmarks[R_OUTER_CORNER].x * w
        r_inner_y  = landmarks[R_INNER_CORNER].y * h
        r_width    = abs(r_outer_x - r_inner_x) + 1e-6
        r_height   = r_width * 0.4

        # Note: for the right eye inner is closer to nose so direction flips
        r_norm_x   = (rcx - r_inner_x) / r_width - 0.5
        r_norm_y   = (rcy - r_inner_y) / r_height - 0.5

        # ── average both eyes ─────────────────────────────────────────────
        avg_norm_x = (l_norm_x + (-r_norm_x)) / 2.0   # flip right X axis
        avg_norm_y = (l_norm_y + r_norm_y)     / 2.0

        return avg_norm_x, avg_norm_y, lcx / w, lcy / h