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
import numpy as np
from ..config import (
    PURSUIT_CYCLES, PURSUIT_DURATION_S, CAMERA_FOV_DEG, COL_TEXT, COL_WARN
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

    @staticmethod
    def _open_camera() -> cv2.VideoCapture:
        attempts: list[tuple[str, cv2.VideoCapture]] = []

        if hasattr(cv2, "CAP_DSHOW"):
            attempts.append(("CAP_DSHOW", cv2.VideoCapture(0, cv2.CAP_DSHOW)))
        if hasattr(cv2, "CAP_MSMF"):
            attempts.append(("CAP_MSMF", cv2.VideoCapture(0, cv2.CAP_MSMF)))
        attempts.append(("DEFAULT", cv2.VideoCapture(0)))

        fallback: cv2.VideoCapture | None = None

        for backend_name, cap in attempts:
            if not cap.isOpened():
                cap.release()
                continue

            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            cap.set(cv2.CAP_PROP_FPS, 30)

            got_frame = False
            has_visual_signal = False
            for _ in range(20):
                ret, frame = cap.read()
                if not ret or frame is None or frame.size == 0:
                    continue
                got_frame = True
                if float(np.var(frame)) > 2.0:
                    has_visual_signal = True
                    break

            if has_visual_signal:
                print(f"[INFO] Camera opened with backend: {backend_name}")
                return cap

            if got_frame and fallback is None:
                fallback = cap
            else:
                cap.release()

        if fallback is not None:
            print("[WARN] Camera feed appears very dark/flat. Continuing with fallback camera backend.")
            return fallback

        raise RuntimeError("Cannot open webcam (device 0).")

    def run(self):
        try:
            cap = self._open_camera()
        except RuntimeError:
            return

        cv2.namedWindow("CogniSense - Smooth Pursuit",
                        cv2.WINDOW_NORMAL)
        cv2.setWindowProperty("CogniSense - Smooth Pursuit",
                              cv2.WND_PROP_FULLSCREEN,
                              cv2.WINDOW_FULLSCREEN)

        # ── instruction ───────────────────────────────────────────────────
        h, w = 720, 1280
        while True:
            ret, frame = cap.read()
            if not ret:
                continue

            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]
            canvas = self._ui.blank(w, h)
            msg = "Follow the GREEN dot with your eyes. Press SPACE."
            cv2.putText(canvas, msg,
                        ((w - cv2.getTextSize(msg, FONT, 0.7, 2)[0][0]) // 2,
                         h // 2),
                        FONT, 0.7, COL_TEXT, 2, cv2.LINE_AA)
            lm = self.tracker.process_frame(frame)
            self._ui.camera_preview(canvas, frame, lm is not None)
            if lm is None:
                self._ui.status_bar(canvas,
                    "Face not detected - center your face before starting", COL_WARN, 0.94)

            cv2.imshow("CogniSense - Smooth Pursuit", canvas)
            if cv2.waitKey(30) == 32:
                break

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
                    "Keep following the green dot...", COL_TEXT)

                now  = time.time()
                lm   = self.tracker.process_frame(frame)
                self._ui.camera_preview(canvas, frame, lm is not None)
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
                else:
                    self._ui.status_bar(canvas,
                        "Face not detected - align face in preview", COL_WARN, 0.94)

                cv2.imshow("CogniSense - Smooth Pursuit", canvas)
                cv2.waitKey(1)
        finally:
            cap.release()
            cv2.destroyAllWindows()

        self.gain = BiomarkerEngine.pursuit_gain(eye_vels, target_vels)
        print(f"[INFO] Smooth Pursuit Gain = {self.gain:.3f}")