"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 SmoothPursuitTask — horizontal sinusoidal tracking (with live explainability)
================================================================================
"""

import math
import time
from typing import List, Optional
import cv2
import numpy as np

from ..config import (
    PURSUIT_CYCLES, PURSUIT_DURATION_S, CAMERA_FOV_DEG,
    COL_TEXT, COL_WARN, COL_GOOD, COL_GAZE,
    HEAD_CENTER_MIN_HOLD_S,
)
from ..data.data_containers import GazePoint
from ..tracking.face_mesh_tracker import FaceMeshTracker
from ..calibration.calibration_engine import CalibrationEngine
from ..analysis.biomarker_engine import BiomarkerEngine
from ..ui.ui_renderer import UIRenderer

FONT = cv2.FONT_HERSHEY_SIMPLEX


class SmoothPursuitTask:

    def __init__(self, tracker: FaceMeshTracker,
                 calibration: CalibrationEngine):
        self.tracker     = tracker
        self.cal         = calibration
        self.pursuit_pts : List[GazePoint] = []
        self.gain        : float = float("nan")
        self._ui         = UIRenderer()

    @staticmethod
    def _open_camera() -> cv2.VideoCapture:
        attempts = []
        if hasattr(cv2, "CAP_DSHOW"):
            attempts.append(("CAP_DSHOW", cv2.VideoCapture(0, cv2.CAP_DSHOW)))
        if hasattr(cv2, "CAP_MSMF"):
            attempts.append(("CAP_MSMF", cv2.VideoCapture(0, cv2.CAP_MSMF)))
        attempts.append(("DEFAULT", cv2.VideoCapture(0)))
        fallback = None
        for name, cap in attempts:
            if not cap.isOpened():
                cap.release(); continue
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            cap.set(cv2.CAP_PROP_FPS, 30)
            got, sig = False, False
            for _ in range(20):
                ret, frame = cap.read()
                if not ret or frame is None or frame.size == 0:
                    continue
                got = True
                if float(np.var(frame)) > 2.0:
                    sig = True; break
            if sig:
                print(f"[INFO] Camera opened with backend: {name}")
                return cap
            if got and fallback is None:
                fallback = cap
            else:
                cap.release()
        if fallback is not None:
            return fallback
        raise RuntimeError("Cannot open webcam (device 0).")

    @staticmethod
    def _head_inside_box(hx: float, hy: float) -> bool:
        from ..config import (HEAD_BOX_W_FRAC, HEAD_BOX_H_FRAC,
                              HEAD_BOX_TOLERANCE)
        if math.isnan(hx):
            return False
        lo_x = 0.5 - HEAD_BOX_W_FRAC / 2 - HEAD_BOX_TOLERANCE
        hi_x = 0.5 + HEAD_BOX_W_FRAC / 2 + HEAD_BOX_TOLERANCE
        lo_y = 0.5 - HEAD_BOX_H_FRAC / 2 - HEAD_BOX_TOLERANCE
        hi_y = 0.5 + HEAD_BOX_H_FRAC / 2 + HEAD_BOX_TOLERANCE
        return (lo_x <= hx <= hi_x) and (lo_y <= hy <= hi_y)

    def run(self):
        try:
            cap = self._open_camera()
        except RuntimeError:
            return
        cv2.namedWindow("CogniSense — Smooth Pursuit", cv2.WINDOW_NORMAL)
        cv2.setWindowProperty("CogniSense — Smooth Pursuit",
                              cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

        # ── instruction / head lock ──────────────────────────────────────
        hold_start = None
        while True:
            ret, frame = cap.read()
            if not ret: continue
            frame = cv2.flip(frame, 1)
            h, w  = frame.shape[:2]
            canvas = self._ui.blank(w, h)

            lm = self.tracker.process_frame(frame)
            hx = hy = float("nan")
            inside = False
            if lm:
                hx, hy = FaceMeshTracker.head_center(lm)
                inside = self._head_inside_box(hx, hy)

            if inside:
                if hold_start is None:
                    hold_start = time.time()
                held = time.time() - hold_start
                msg = (f"Hold position… press SPACE when the counter "
                       f"reaches {HEAD_CENTER_MIN_HOLD_S:.1f}s  "
                       f"({held:.1f}s)")
                self._ui.status_bar(canvas, msg, COL_GOOD)
                if held >= HEAD_CENTER_MIN_HOLD_S:
                    cv2.putText(canvas,
                                "Follow the GREEN dot with your eyes. Press SPACE.",
                                (40, h - 40), FONT, 0.7, COL_TEXT, 2, cv2.LINE_AA)
            else:
                hold_start = None
                self._ui.status_bar(canvas,
                    "Move your head inside the box to continue", COL_WARN, 0.95)

            self._ui.camera_preview_with_headlock(
                canvas, frame, hx, hy, inside,
                face_detected=(lm is not None))

            cv2.imshow("CogniSense — Smooth Pursuit", canvas)
            if cv2.waitKey(30) == 32 and inside:
                break

        # ── tracking loop ────────────────────────────────────────────────
        start = time.time()
        end   = start + PURSUIT_DURATION_S        
        amp   = (w // 2) - 100
        freq  = PURSUIT_CYCLES / PURSUIT_DURATION_S

        eye_vels    : List[float] = []
        target_vels : List[float] = []
        prev_tx     : Optional[float] = None
        prev_nx     : Optional[float] = None
        prev_t      : Optional[float] = None
        head_out_frames = 0
        total_frames    = 0

        try:
            while time.time() < end:
                ret, frame = cap.read()
                if not ret: continue
                frame  = cv2.flip(frame, 1)
                canvas = self._ui.blank(w, h)

                t   = time.time() - start
                tx  = w // 2 + int(amp * math.sin(2 * math.pi * freq * t))
                tx_norm = (tx - w // 2) / (w // 2)     # -1 … +1
                self._ui.pursuit_dot(canvas, tx, h // 2)

                now = time.time()
                lm  = self.tracker.process_frame(frame)
                hx = hy = float("nan")
                inside = True
                if lm:
                    hx, hy = FaceMeshTracker.head_center(lm)
                    inside = self._head_inside_box(hx, hy)

                total_frames += 1
                if not inside:
                    head_out_frames += 1

                gaze_norm = float("nan")
                if lm:
                    nx, ny, rlx, rly = FaceMeshTracker.extract_gaze(lm, w, h)
                    nx, ny = self.cal.correct(nx, ny)
                    
                    # Only treat point as valid if BOTH coordinates are non-NaN
                    if not math.isnan(nx) and not math.isnan(ny):
                        gaze_norm = nx
                        gp = GazePoint(now, -1, "pursuit", "none",
                                       nx, ny, rlx, rly, True,
                                       head_x=hx, head_y=hy, head_inside=inside)
                        self.pursuit_pts.append(gp)
                        self._ui.gaze_dot(canvas, nx, ny, colour=COL_GAZE)

                        if prev_nx is not None and prev_t is not None and prev_tx is not None:
                            dt = now - prev_t
                            if dt > 0:
                                e_vel = (nx - prev_nx) / dt * (CAMERA_FOV_DEG / 2)
                                t_vel = (tx_norm - (prev_tx - w // 2) / (w // 2)) \
                                        / dt * (CAMERA_FOV_DEG / 2)
                                if not math.isnan(e_vel) and not math.isnan(t_vel):
                                    eye_vels.append(e_vel)
                                    target_vels.append(t_vel)

                        prev_nx = nx
                        prev_tx = tx
                        prev_t  = now

                # camera preview with head box + marker
                self._ui.camera_preview_with_headlock(
                    canvas, frame, hx, hy, inside,
                    face_detected=(lm is not None))

                # ── explainability bar ───────────────────────────────────
                self._ui.gaze_vs_target_bar(
                    canvas, gaze_norm, tx_norm,
                    "Your gaze (●)  vs.  Pursuit target (▮)",
                    COL_TEXT)

                if not inside:
                    self._ui.status_bar(
                        canvas,
                        "HEAD OUT OF BOX — re-centre to continue tracking",
                        COL_WARN, 0.95)
                else:
                    self._ui.status_bar(
                        canvas, "Keep following the green dot…", COL_TEXT)

                cv2.imshow("CogniSense — Smooth Pursuit", canvas)
                cv2.waitKey(1)
        finally:
            cap.release()
            cv2.destroyAllWindows()

        # If the head was out of the box more than 30 % of the time, refuse
        # to report a gain (unreliable).
        if total_frames > 0 and head_out_frames / total_frames > 0.30:
            print("[WARN] Smooth pursuit: head was out of box too often — "
                  "gain set to NaN.")
            self.gain = float("nan")
        else:
            self.gain = BiomarkerEngine.pursuit_gain(eye_vels, target_vels)
            print(f"[INFO] Smooth Pursuit Gain = {self.gain:.3f}")