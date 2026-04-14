"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 SmoothPursuitTask - Horizontal sinusoidal tracking task
================================================================================
"""

import math
import time
from typing import List, Optional
import cv2
from ..config import (
    PURSUIT_CYCLES, PURSUIT_DURATION_S, CAMERA_FOV_DEG, COL_TEXT
)
from ..data.data_containers import GazePoint
from ..tracking.face_mesh_tracker import FaceMeshTracker
from ..calibration.calibration_engine import CalibrationEngine
from ..analysis.biomarker_engine import BiomarkerEngine
from ..ui.ui_renderer import UIRenderer

FONT = cv2.FONT_HERSHEY_SIMPLEX


class SmoothPursuitTask:
    """
    Optional horizontal sinusoidal tracking task.
    Computes Gaze Gain = Eye Velocity / Target Velocity.
    """

    def __init__(self, tracker: FaceMeshTracker,
                 calibration: CalibrationEngine):
        self.tracker     = tracker
        self.cal         = calibration
        self.pursuit_pts : List[GazePoint] = []
        self.gain        : float = float("nan")
        self._ui         = UIRenderer()

    def run(self):
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            return
        cap.set(cv2.CAP_PROP_FPS, 30)

        cv2.namedWindow("CogniSense — Smooth Pursuit",
                        cv2.WINDOW_NORMAL)
        cv2.setWindowProperty("CogniSense — Smooth Pursuit",
                              cv2.WND_PROP_FULLSCREEN,
                              cv2.WINDOW_FULLSCREEN)

        # ── instruction ───────────────────────────────────────────────────
        ret, frame = cap.read()
        h, w = frame.shape[:2] if ret else (720, 1280)
        canvas = self._ui.blank(w, h)
        msg = "Follow the GREEN dot with your eyes.  Press SPACE."
        cv2.putText(canvas, msg,
                    ((w - cv2.getTextSize(msg, FONT, 0.7, 2)[0][0]) // 2,
                     h // 2),
                    FONT, 0.7, COL_TEXT, 2, cv2.LINE_AA)
        cv2.imshow("CogniSense — Smooth Pursuit", canvas)
        while cv2.waitKey(30) != 32:
            pass

        start  = time.time()
        end    = start + PURSUIT_DURATION_S
        amp    = (w // 2) - 100     # amplitude (pixels)
        freq   = PURSUIT_CYCLES / PURSUIT_DURATION_S   # Hz

        eye_vels    : List[float]  = []
        target_vels : List[float]  = []
        prev_tx     : Optional[float] = None
        prev_nx     : Optional[float] = None
        prev_t      : Optional[float] = None

        try:
            while time.time() < end:
                ret, frame = cap.read()
                if not ret:
                    continue
                frame  = cv2.flip(frame, 1)
                canvas = self._ui.blank(w, h)

                t    = time.time() - start
                tx   = w // 2 + int(amp * math.sin(2 * math.pi * freq * t))
                self._ui.pursuit_dot(canvas, tx, h // 2)
                self._ui.status_bar(canvas,
                    "Keep following the green dot…", COL_TEXT)
                cv2.imshow("CogniSense — Smooth Pursuit", canvas)
                cv2.waitKey(1)

                now  = time.time()
                lm   = self.tracker.process_frame(frame)
                if lm:
                    nx, ny, rlx, rly = FaceMeshTracker.extract_gaze(
                        lm, w, h)
                    nx, ny = self.cal.correct(nx, ny)
                    gp = GazePoint(now, -1, "pursuit", "none",
                                   nx, ny, rlx, rly, True)
                    self.pursuit_pts.append(gp)

                    if prev_nx is not None and prev_t is not None:
                        dt = now - prev_t
                        if dt > 0:
                            e_vel = (nx - prev_nx) / dt * (CAMERA_FOV_DEG / 2)
                            t_vel = (tx - prev_tx) / w  * (CAMERA_FOV_DEG / 2) / dt
                            eye_vels.append(e_vel)
                            target_vels.append(t_vel)

                    prev_nx = nx
                    prev_tx = tx
                    prev_t  = now
        finally:
            cap.release()
            cv2.destroyAllWindows()

        self.gain = BiomarkerEngine.pursuit_gain(eye_vels, target_vels)
        print(f"[INFO] Smooth Pursuit Gain = {self.gain:.3f}")