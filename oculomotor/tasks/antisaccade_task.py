"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 AntisaccadeTask - 20-trial antisaccade paradigm
================================================================================
"""

import math
import random
import time
from typing import List, Optional
import cv2
import numpy as np
from ..config import (
    ANTISACCADE_TRIALS, FIXATION_DURATION_S, RESPONSE_WINDOW_S,
    STIMULUS_OFFSET_PX, CALIBRATION_DURATION_S, COL_TEXT, COL_WARN
)
from ..data.data_containers import GazePoint, TrialResult
from ..tracking.face_mesh_tracker import FaceMeshTracker
from ..calibration.calibration_engine import CalibrationEngine
from ..analysis.biomarker_engine import BiomarkerEngine
from ..ui.ui_renderer import UIRenderer

FONT = cv2.FONT_HERSHEY_SIMPLEX


class AntisaccadeTask:
    """
    Runs the full 20-trial antisaccade paradigm.

    Trial flow (per trial)
    ──────────────────────
      1.  Fixation cross   ─ FIXATION_DURATION_S seconds
      2.  Stimulus dot     ─ RESPONSE_WINDOW_S   seconds
         (Record all gaze data during stimulus window)
    """

    def __init__(self, tracker: FaceMeshTracker,
                 calibration: CalibrationEngine,
                 n_trials: int = ANTISACCADE_TRIALS):
        self.tracker     = tracker
        self.cal         = calibration
        self.n_trials    = n_trials
        self.trial_sides : List[str]        = []
        self.all_points  : List[GazePoint]  = []
        self.trial_results: List[TrialResult] = []
        self._ui         = UIRenderer()
        self._cap        = None

    # ── internal helpers ──────────────────────────────────────────────────
    def _read_gaze(self, frame: np.ndarray, t: float,
                   trial_id: int, phase: str,
                   stimulus_side: str = "none"
                   ) -> Optional[GazePoint]:
        """Process one frame and return a GazePoint (or None if no face)."""
        h, w = frame.shape[:2]
        lm   = self.tracker.process_frame(frame)
        if lm is None:
            return GazePoint(t, trial_id, phase, stimulus_side,
                             float("nan"), float("nan"),
                             float("nan"), float("nan"),
                             face_detected=False)
        nx, ny, rlx, rly = FaceMeshTracker.extract_gaze(lm, w, h)
        nx, ny           = self.cal.correct(nx, ny)
        return GazePoint(t, trial_id, phase, stimulus_side,
                         nx, ny, rlx, rly, face_detected=True)

    def _get_stim_x(self, side: str, w: int) -> int:
        cx = w // 2
        return cx - STIMULUS_OFFSET_PX if side == "left" else cx + STIMULUS_OFFSET_PX

    # ── calibration phase ─────────────────────────────────────────────────
    def run_calibration(self, cap):
        """Show a central dot for CALIBRATION_DURATION_S and collect baseline."""
        print("[INFO] Starting calibration…")
        end = time.time() + CALIBRATION_DURATION_S
        while time.time() < end:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            h, w  = frame.shape[:2]
            canvas = self._ui.blank(w, h)
            # big central circle
            cv2.circle(canvas, (w // 2, h // 2), 25, (255, 255, 255), -1)
            remaining = max(0, end - time.time())
            self._ui.status_bar(canvas,
                f"CALIBRATION — Look at the white dot  [{remaining:.1f}s]",
                colour=COL_TEXT)
            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            cv2.waitKey(1)

            t  = time.time()
            lm = self.tracker.process_frame(frame)
            if lm:
                nx, ny, _, _ = FaceMeshTracker.extract_gaze(
                    lm, frame.shape[1], frame.shape[0])
                self.cal.add_sample(nx, ny)
        self.cal.finalise()
        self.cal.save()
        print(f"[INFO] Calibration done. Baseline: x={self.cal.baseline_x:.4f}  "
              f"y={self.cal.baseline_y:.4f}")

    # ── instruction screen ────────────────────────────────────────────────
    def _show_instructions(self, cap):
        lines = [
            "ANTISACCADE TASK",
            "",
            "A red dot will appear LEFT or RIGHT.",
            "Look at the OPPOSITE side from the dot.",
            "",
            "Try not to blink or look away from the camera.",
            "",
            "Press SPACE to begin.",
        ]
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
            h, w  = frame.shape[:2]
            canvas = self._ui.blank(w, h)
            y0    = h // 2 - len(lines) * 28 // 2
            for i, line in enumerate(lines):
                sz   = 0.9 if i == 0 else 0.65
                col  = (255, 200, 50) if i == 0 else COL_TEXT
                thick = 2
                tw, _ = cv2.getTextSize(line, FONT, sz, thick)[0], 0
                cx_   = (w - cv2.getTextSize(line, FONT, sz, thick)[0][0]) // 2
                cv2.putText(canvas, line, (cx_, y0 + i * 35),
                            FONT, sz, col, thick, cv2.LINE_AA)
            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            key = cv2.waitKey(30)
            if key == 32:   # SPACE
                break

    # ── single trial ──────────────────────────────────────────────────────
    def _run_trial(self, cap, trial_id: int, side: str) -> TrialResult:
        h_ref = None    # lazily obtained
        w_ref = None

        fixation_pts : List[GazePoint] = []
        stim_pts     : List[GazePoint] = []
        stim_onset_s : float           = 0.0
        lost_face_count: int           = 0

        # ── Phase 1: Fixation ─────────────────────────────────────────────
        end_fix = time.time() + FIXATION_DURATION_S
        while time.time() < end_fix:
            ret, frame = cap.read()
            if not ret:
                continue
            frame  = cv2.flip(frame, 1)
            h_ref, w_ref = frame.shape[:2]
            canvas = self._ui.blank(w_ref, h_ref)
            self._ui.fixation_cross(canvas, w_ref // 2, h_ref // 2)
            self._ui.status_bar(canvas,
                f"Trial {trial_id}/{self.n_trials}  ·  Look at the cross")
            self._ui.progress_bar(canvas, trial_id - 1, self.n_trials)

            t   = time.time()
            gp  = self._read_gaze(frame, t, trial_id, "fixation", "none")
            fixation_pts.append(gp)
            if gp.face_detected and not math.isnan(gp.norm_x):
                self._ui.gaze_dot(canvas, gp.norm_x, gp.norm_y)
            if not gp.face_detected:
                lost_face_count += 1
                self._ui.status_bar(canvas,
                    "⚠ Face not detected — look at camera", COL_WARN, 0.95)

            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            cv2.waitKey(1)

        # ── Phase 2: Stimulus ─────────────────────────────────────────────
        stim_onset_s = time.time()
        stim_x       = self._get_stim_x(side, w_ref)
        end_stim     = stim_onset_s + RESPONSE_WINDOW_S

        while time.time() < end_stim:
            ret, frame = cap.read()
            if not ret:
                continue
            frame  = cv2.flip(frame, 1)
            canvas = self._ui.blank(w_ref, h_ref)
            self._ui.stimulus_dot(canvas, stim_x, h_ref // 2)
            self._ui.fixation_cross(canvas, w_ref // 2, h_ref // 2, size=15)

            instr = f"Look {'RIGHT' if side == 'left' else 'LEFT'}!"
            cv2.putText(canvas, instr,
                        ((w_ref - cv2.getTextSize(instr, FONT, 0.9, 2)[0][0]) // 2,
                         h_ref // 2 - 60),
                        FONT, 0.9, (200, 200, 50), 2, cv2.LINE_AA)
            self._ui.status_bar(canvas,
                f"Trial {trial_id}/{self.n_trials}  ·  {instr}")
            self._ui.progress_bar(canvas, trial_id - 1, self.n_trials)

            t   = time.time()
            gp  = self._read_gaze(frame, t, trial_id, "stimulus", side)
            stim_pts.append(gp)
            if gp.face_detected and not math.isnan(gp.norm_x):
                self._ui.gaze_dot(canvas, gp.norm_x, gp.norm_y)

            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            cv2.waitKey(1)

        # ── Merge all points ──────────────────────────────────────────────
        all_trial_pts = fixation_pts + stim_pts
        self.all_points.extend(all_trial_pts)

        # ── Compute biomarkers ─────────────────────────────────────────────
        valid_fix  = [p for p in fixation_pts if p.face_detected
                      and not math.isnan(p.norm_x)]
        valid_stim = [p for p in stim_pts if p.face_detected
                      and not math.isnan(p.norm_x)]

        rmsd    = BiomarkerEngine.fixation_rmsd(valid_fix)
        is_err, lat_ms, first_vel = BiomarkerEngine.classify_trial(
            stim_onset_s, side, valid_stim)

        result = TrialResult(
            trial_id         = trial_id,
            stimulus_side    = side,
            correct_side     = "left" if side == "right" else "right",
            is_error         = is_err,
            latency_ms       = lat_ms,
            first_velocity   = first_vel,
            fixation_rmsd    = rmsd,
            frames_collected = len(all_trial_pts),
        )
        print(f"  Trial {trial_id:2d} | stim={side:5s} | "
              f"error={'YES' if is_err else 'no ':3s} | "
              f"latency={lat_ms:6.1f}ms | rmsd={rmsd:.4f}")
        return result

    # ── main entry point ──────────────────────────────────────────────────
    def run(self):
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            raise RuntimeError("Cannot open webcam (device 0).")
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS,          30)

        cv2.namedWindow("CogniSense — Oculomotor Assessment",
                        cv2.WINDOW_NORMAL)
        cv2.setWindowProperty("CogniSense — Oculomotor Assessment",
                              cv2.WND_PROP_FULLSCREEN,
                              cv2.WINDOW_FULLSCREEN)

        try:
            self.run_calibration(cap)
            self._show_instructions(cap)

            # Build randomised, balanced trial order
            sides = (["left"] * (self.n_trials // 2)
                     + ["right"] * (self.n_trials // 2))
            random.shuffle(sides)
            self.trial_sides = sides

            print("\n[INFO] Beginning antisaccade task…\n")
            for tid, side in enumerate(sides, start=1):
                result = self._run_trial(cap, tid, side)
                self.trial_results.append(result)
                # Brief inter-trial interval
                time.sleep(0.3)

        finally:
            cap.release()
            cv2.destroyAllWindows()