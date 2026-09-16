"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 FaceMeshTracker — MediaPipe iris tracking + head-pose detection
================================================================================
"""

from typing import List, Optional, Tuple
import cv2
import mediapipe as mp
import numpy as np

from ..config import (
    L_INNER_CORNER, L_OUTER_CORNER, R_INNER_CORNER, R_OUTER_CORNER,
    LIRS_INDICES_FULL, RIRS_INDICES_FULL
)


class FaceMeshTracker:
    """Wraps MediaPipe FaceMesh (478-landmark iris-refined model)."""

    def __init__(self, max_faces: int = 1, min_detection_conf: float = 0.5,
                 min_tracking_conf: float = 0.5):
        self._mp_fm = mp.solutions.face_mesh
        self._fm    = None
        self._max   = max_faces
        self._det_c = min_detection_conf
        self._trk_c = min_tracking_conf

    def __enter__(self):
        self._fm = self._mp_fm.FaceMesh(
            static_image_mode        = False,
            max_num_faces            = self._max,
            refine_landmarks         = True,
            min_detection_confidence = self._det_c,
            min_tracking_confidence  = self._trk_c,
        )
        return self

    def __exit__(self, *_):
        if self._fm:
            self._fm.close()

    # ── processing ────────────────────────────────────────────────────────
    def process_frame(self, bgr: np.ndarray) -> Optional[list]:
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        results = self._fm.process(rgb)
        if results.multi_face_landmarks:
            return results.multi_face_landmarks[0].landmark
        return None

    # ── head-pose ─────────────────────────────────────────────────────────
    @staticmethod
    def head_center(landmarks: list) -> Tuple[float, float]:
        """
        Approximate head centre in normalised [0,1] frame coordinates.
        Uses the nose tip (landmark 1) and the eye midpoint — both are
        stable under small facial-expression changes.
        """
        nose = landmarks[1]
        l_eye = landmarks[33]     # left eye outer corner
        r_eye = landmarks[263]    # right eye outer corner
        cx = (l_eye.x + r_eye.x + nose.x) / 3.0
        cy = (l_eye.y + r_eye.y + nose.y) / 3.0
        return float(cx), float(cy)

    @staticmethod
    def eye_width(landmarks: list, inner: int, outer: int, w: int) -> float:
        x1 = landmarks[inner].x * w
        x2 = landmarks[outer].x * w
        return abs(x2 - x1) + 1e-6

    @staticmethod
    def iris_centroid(landmarks: list, indices: List[int],
                      w: int, h: int) -> Tuple[float, float]:
        xs = [landmarks[i].x * w for i in indices]
        ys = [landmarks[i].y * h for i in indices]
        return float(np.mean(xs)), float(np.mean(ys))

    @classmethod
    def extract_gaze(cls, landmarks: list, w: int, h: int
                     ) -> Tuple[float, float, float, float]:
        """Return head-pose-normalised gaze vector for both eyes averaged."""
        # left eye
        lcx, lcy   = cls.iris_centroid(landmarks, LIRS_INDICES_FULL, w, h)
        l_inner_x  = landmarks[L_INNER_CORNER].x * w
        l_outer_x  = landmarks[L_OUTER_CORNER].x * w
        l_inner_y  = landmarks[L_INNER_CORNER].y * h
        l_width    = abs(l_outer_x - l_inner_x) + 1e-6
        l_height   = l_width * 0.4
        l_norm_x   = (lcx - l_inner_x) / l_width - 0.5
        l_norm_y   = (lcy - l_inner_y) / l_height - 0.5

        # right eye
        rcx, rcy   = cls.iris_centroid(landmarks, RIRS_INDICES_FULL, w, h)
        r_inner_x  = landmarks[R_INNER_CORNER].x * w
        r_outer_x  = landmarks[R_OUTER_CORNER].x * w
        r_inner_y  = landmarks[R_INNER_CORNER].y * h
        r_width    = abs(r_outer_x - r_inner_x) + 1e-6
        r_height   = r_width * 0.4
        r_norm_x   = (rcx - r_inner_x) / r_width - 0.5
        r_norm_y   = (rcy - r_inner_y) / r_height - 0.5

        avg_norm_x = (l_norm_x + (-r_norm_x)) / 2.0
        avg_norm_y = (l_norm_y + r_norm_y)     / 2.0

        return avg_norm_x, avg_norm_y, lcx / w, lcy / h