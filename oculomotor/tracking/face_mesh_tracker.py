"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 FaceMeshTracker — MediaPipe iris tracking + head-pose detection
================================================================================
"""

import math
from typing import List, Optional, Tuple
import cv2
import mediapipe as mp
import numpy as np

from ..config import (
    L_INNER_CORNER, L_OUTER_CORNER, R_INNER_CORNER, R_OUTER_CORNER,
    L_UPPER_LID, L_LOWER_LID, R_UPPER_LID, R_LOWER_LID,
    LIRS_INDICES_FULL, RIRS_INDICES_FULL,
    GAZE_X_GAIN, GAZE_Y_GAIN,
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

    # ── gaze extraction ───────────────────────────────────────────────────
    @classmethod
    def extract_gaze(cls, landmarks: list, w: int, h: int
                     ) -> Tuple[float, float, float, float]:
        """
        Return a *raw* (uncorrected) gaze vector, averaged over both eyes.
        Convention:
            norm_x = 0   → iris centred horizontally between corners
            norm_x < 0   → iris toward the subject's LEFT eye corner
            norm_x > 0   → iris toward the subject's RIGHT eye corner
            norm_y = 0   → iris vertically centred between eyelids
            norm_y < 0   → looking UP (towards upper eyelid)
            norm_y > 0   → looking DOWN (towards lower eyelid)

        CalibrationEngine removes the subject-specific offset later.
        """
        def _eye(cx_iris: float, cy_iris: float,
                 x_corner_a: float, x_corner_b: float,
                 y_lid_a: float, y_lid_b: float) -> Tuple[float, float]:
            """Return (ratio_x, ratio_y) for one eye, roughly in [-0.5, +0.5]."""
            dx = x_corner_b - x_corner_a
            dy_w = y_lid_b - y_lid_a

            # Reject horizontal frames with degenerate eye-width (< 5 px)
            if abs(dx) < 5.0:
                ratio_x = float("nan")
            else:
                # Use abs(dx) so landmark index order does not invert one eye
                ratio_x = (cx_iris - x_corner_a) / abs(dx) - 0.5

            # Reject vertical frames with degenerate eye-opening (< 3 px)
            if abs(dy_w) < 3.0:
                ratio_y = float("nan")
            else:
                ratio_y = (cy_iris - y_lid_a) / dy_w - 0.5

            return ratio_x, ratio_y

        # ── left eye ─────────────────────────────────────────────────────
        lcx, lcy = cls.iris_centroid(landmarks, LIRS_INDICES_FULL, w, h)
        l_ratio_x, l_ratio_y = _eye(
            cx_iris    = lcx,
            cy_iris    = lcy,
            x_corner_a = landmarks[L_INNER_CORNER].x * w,
            x_corner_b = landmarks[L_OUTER_CORNER].x * w,
            y_lid_a    = landmarks[L_UPPER_LID].y   * h,
            y_lid_b    = landmarks[L_LOWER_LID].y   * h,
        )

        # ── right eye ────────────────────────────────────────────────────
        rcx, rcy = cls.iris_centroid(landmarks, RIRS_INDICES_FULL, w, h)
        r_ratio_x, r_ratio_y = _eye(
            cx_iris    = rcx,
            cy_iris    = rcy,
            x_corner_a = landmarks[R_INNER_CORNER].x * w,
            x_corner_b = landmarks[R_OUTER_CORNER].x * w,
            y_lid_a    = landmarks[R_UPPER_LID].y   * h,
            y_lid_b    = landmarks[R_LOWER_LID].y   * h,
        )

        # ── combine both eyes ────────────────────────────────────────────
        xs = [v for v in (l_ratio_x, r_ratio_x) if not math.isnan(v)]
        ys = [v for v in (l_ratio_y, r_ratio_y) if not math.isnan(v)]

        avg_norm_x = float(np.mean(xs)) if xs else float("nan")
        avg_norm_y = float(np.mean(ys)) if ys else float("nan")

        # Apply GAZE_X_GAIN and GAZE_Y_GAIN (3.0)
        if not math.isnan(avg_norm_x):
            avg_norm_x *= GAZE_X_GAIN
        if not math.isnan(avg_norm_y):
            avg_norm_y *= GAZE_Y_GAIN

        return avg_norm_x, avg_norm_y, lcx / w, lcy / h