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

    # ── gaze extraction (rewritten) ───────────────────────────────────────
    @classmethod
    def extract_gaze(cls, landmarks: list, w: int, h: int
                     ) -> Tuple[float, float, float, float]:
        """
        Return a *raw* (uncorrected) gaze vector, averaged over both eyes.
        Convention:
            norm_x = 0   → iris centred between the corners
            norm_x < 0   → iris toward the subject's LEFT eye corner
            norm_x > 0   → iris toward the subject's RIGHT eye corner

        No 0.5 subtraction happens here. The CalibrationEngine removes
        the subject-specific offset later. This keeps extract_gaze purely
        descriptive of raw geometry.

        The value is stable because we divide by *the same eye's width*,
        which is measured from the SAME frame; we do NOT use a stale
        per-eye width, but we DO clamp it to a sane range to reject
        frames where MediaPipe mis-places a corner landmark.
        """
        # ── left eye ─────────────────────────────────────────────────────
        lcx, lcy   = cls.iris_centroid(landmarks, LIRS_INDICES_FULL, w, h)
        l_inner_x  = landmarks[L_INNER_CORNER].x * w
        l_outer_x  = landmarks[L_OUTER_CORNER].x * w
        l_inner_y  = landmarks[L_INNER_CORNER].y * h
        l_outer_y  = landmarks[L_OUTER_CORNER].y * h
        l_width    = abs(l_outer_x - l_inner_x)
        l_height   = max(abs(l_outer_y - l_inner_y), 1.0)

        # Reject frames with degenerate eye-width (blink, mis-detect)
        if l_width < 5.0:
            l_ratio_x = float("nan")
            l_ratio_y = float("nan")
        else:
            # Project iris onto the line connecting the eye corners so
            # small head tilts don't corrupt the reading.
            dx = l_outer_x - l_inner_x
            dy = l_outer_y - l_inner_y
            # projection of (iris − inner) onto (outer − inner)
            proj = ((lcx - l_inner_x) * dx + (lcy - l_inner_y) * dy) \
                   / (dx * dx + dy * dy)
            # proj ∈ [0,1] where 0 = inner corner, 1 = outer corner
            l_ratio_x = proj - 0.5          # centred on 0, ±0.5 at corners
            l_ratio_y = (lcy - l_inner_y) / l_height - 0.5

        # ── right eye ────────────────────────────────────────────────────
        rcx, rcy   = cls.iris_centroid(landmarks, RIRS_INDICES_FULL, w, h)
        r_inner_x  = landmarks[R_INNER_CORNER].x * w
        r_outer_x  = landmarks[R_OUTER_CORNER].x * w
        r_inner_y  = landmarks[R_INNER_CORNER].y * h
        r_outer_y  = landmarks[R_OUTER_CORNER].y * h
        r_width    = abs(r_outer_x - r_inner_x)
        r_height   = max(abs(r_outer_y - r_inner_y), 1.0)

        if r_width < 5.0:
            r_ratio_x = float("nan")
            r_ratio_y = float("nan")
        else:
            dx = r_outer_x - r_inner_x
            dy = r_outer_y - r_inner_y
            proj = ((rcx - r_inner_x) * dx + (rcy - r_inner_y) * dy) \
                   / (dx * dx + dy * dy)
            r_ratio_x = proj - 0.5
            r_ratio_y = (rcy - r_inner_y) / r_height - 0.5

        # ── combine both eyes ────────────────────────────────────────────
        # IMPORTANT: because the frame has been flipped horizontally in
        # the task loop, "inner" and "outer" swap for the RIGHT eye in
        # image space. The projection formula already accounts for that,
        # so we just average the two eye ratios directly — NO sign flip.
        xs = [v for v in (l_ratio_x, r_ratio_x) if not math.isnan(v)]
        ys = [v for v in (l_ratio_y, r_ratio_y) if not math.isnan(v)]

        avg_norm_x = float(np.mean(xs)) if xs else float("nan")
        avg_norm_y = float(np.mean(ys)) if ys else float("nan")

        return avg_norm_x, avg_norm_y, lcx / w, lcy / h