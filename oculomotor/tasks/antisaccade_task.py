"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 AntisaccadeTask — 20-trial antisaccade paradigm (with head-lock + live feedback)
================================================================================
"""

import math
import random
import time
from typing import List, Optional, Tuple
import cv2
import numpy as np

from ..config import (
    ANTISACCADE_TRIALS, FIXATION_DURATION_S, RESPONSE_WINDOW_S,
    STIMULUS_OFFSET_PX, CALIBRATION_DURATION_S,
    COL_TEXT, COL_WARN, COL_GOOD, COL_BAD, COL_GAZE,
    HEAD_BOX_W_FRAC, HEAD_BOX_H_FRAC,
    HEAD_BOX_TOLERANCE, HEAD_CENTER_MIN_HOLD_S,
)
from ..data.data_containers import GazePoint, TrialResult
from ..tracking.face_mesh_tracker import FaceMeshTracker
from ..calibration.calibration_engine import CalibrationEngine
from ..analysis.biomarker_engine import BiomarkerEngine
from ..ui.ui_renderer import UIRenderer

FONT = cv2.FONT_HERSHEY_SIMPLEX


class AntisaccadeTask:

    def __init__(self, tracker: FaceMeshTracker,
                 calibration: CalibrationEngine,
                 n_trials: int = ANTISACCADE_TRIALS):
        self.tracker      = tracker
        self.cal          = calibration
        self.n_trials     = n_trials
        self.trial_sides  : List[str]           = []
        self.all_points   : List[GazePoint]     = []
        self.trial_results: List[TrialResult]   = []
        self._ui          = UIRenderer()

    # ── camera ────────────────────────────────────────────────────────────
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
            print("[WARN] Using fallback camera backend.")
            return fallback
        raise RuntimeError("Cannot open webcam (device 0).")

    # ── head-lock check ───────────────────────────────────────────────────
    @staticmethod
    def _head_inside_box(hx: float, hy: float) -> bool:
        if math.isnan(hx):
            return False
        lo_x = 0.5 - HEAD_BOX_W_FRAC / 2 - HEAD_BOX_TOLERANCE
        hi_x = 0.5 + HEAD_BOX_W_FRAC / 2 + HEAD_BOX_TOLERANCE
        lo_y = 0.5 - HEAD_BOX_H_FRAC / 2 - HEAD_BOX_TOLERANCE
        hi_y = 0.5 + HEAD_BOX_H_FRAC / 2 + HEAD_BOX_TOLERANCE
        return (lo_x <= hx <= hi_x) and (lo_y <= hy <= hi_y)

    # ── read one frame's gaze + head ──────────────────────────────────────
    def _read_gaze(self, frame, t, trial_id, phase,
                   stimulus_side="none") -> GazePoint:
        h, w = frame.shape[:2]
        lm = self.tracker.process_frame(frame)
        if lm is None:
            return GazePoint(t, trial_id, phase, stimulus_side,
                             float("nan"), float("nan"),
                             float("nan"), float("nan"),
                             face_detected=False,
                             head_x=float("nan"), head_y=float("nan"),
                             head_inside=False)
        nx, ny, rlx, rly = FaceMeshTracker.extract_gaze(lm, w, h)
        nx, ny = self.cal.correct(nx, ny)
        hx, hy = FaceMeshTracker.head_center(lm)
        inside = self._head_inside_box(hx, hy)
        return GazePoint(t, trial_id, phase, stimulus_side,
                         nx, ny, rlx, rly, True,
                         head_x=hx, head_y=hy, head_inside=inside)

    def _get_stim_x(self, side: str, w: int) -> int:
        cx = w // 2
        return cx - STIMULUS_OFFSET_PX if side == "left" else cx + STIMULUS_OFFSET_PX


        # ── calibration ready screen ──────────────────────────────────────────
    def _show_calibration_ready(self, cap):
        """
        Wait for the subject to press SPACE before starting calibration.
        Gives them time to settle, remove glasses, etc.
        """
        lines = [
            "GET READY FOR CALIBRATION",
            "",
            "In a moment you will see a white dot in the centre.",
            "Please look at the dot and keep your HEAD still",
            "inside the box shown in the top-right preview.",
            "",
            "Calibration takes about 5 seconds.",
            "",
            "Press SPACE when you are ready.",
        ]
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            h, w  = frame.shape[:2]
            canvas = self._ui.blank(w, h)

            y0 = h // 2 - len(lines) * 28 // 2
            for i, line in enumerate(lines):
                sz    = 0.9 if i == 0 else 0.65
                col   = (255, 200, 50) if i == 0 else COL_TEXT
                (tw, _), _ = cv2.getTextSize(line, FONT, sz, 2)
                cx_   = (w - tw) // 2
                cv2.putText(canvas, line, (cx_, y0 + i * 35),
                            FONT, sz, col, 2, cv2.LINE_AA)

            lm = self.tracker.process_frame(frame)
            hx = hy = float("nan")
            inside = False
            if lm:
                hx, hy = FaceMeshTracker.head_center(lm)
                inside = self._head_inside_box(hx, hy)

            self._ui.camera_preview_with_headlock(
                canvas, frame, hx, hy, inside,
                face_detected=(lm is not None))

            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            key = cv2.waitKey(30)
            if key == 32:    # SPACE
                break
            if key == 27:    # ESC
                return False
        return True
    # ── calibration ───────────────────────────────────────────────────────
    def run_calibration(self, cap):
        print("[INFO] Starting calibration...")
        end = time.time() + CALIBRATION_DURATION_S
        while time.time() < end:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            h, w  = frame.shape[:2]
            canvas = self._ui.blank(w, h)

            # central fixation dot — this is what the subject looks at
            cv2.circle(canvas, (w // 2, h // 2), 25, (255, 255, 255), -1)

            remaining = max(0, end - time.time())
            self._ui.status_bar(
                canvas,
                f"CALIBRATION — look at the white dot  [{remaining:.1f}s]",
                COL_TEXT)

            lm = self.tracker.process_frame(frame)
            hx = hy = float("nan")
            inside = False
            if lm:
                nx, ny, _, _ = FaceMeshTracker.extract_gaze(lm, w, h)
                hx, hy = FaceMeshTracker.head_center(lm)
                inside = self._head_inside_box(hx, hy)
                self.cal.add_sample(nx, ny, hx, hy)

            # camera preview with head box + marker on top
            self._ui.camera_preview_with_headlock(
                canvas, frame, hx, hy, inside,
                face_detected=(lm is not None))

            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            cv2.waitKey(1)

        self.cal.finalise()
        self.cal.save()
        print(f"[INFO] Calibration done. Baseline x={self.cal.baseline_x:.4f} "
              f"y={self.cal.baseline_y:.4f}")

    # ── instructions ──────────────────────────────────────────────────────
    def _show_instructions(self, cap):
        lines = [
            "ANTISACCADE TASK",
            "",
            "Keep your HEAD inside the small box (top-right preview).",
            "A red dot will appear LEFT or RIGHT.",
            "Look at the OPPOSITE side from the dot.",
            "",
            "Press SPACE to begin.",
        ]
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            h, w  = frame.shape[:2]
            canvas = self._ui.blank(w, h)

            y0 = h // 2 - len(lines) * 28 // 2
            for i, line in enumerate(lines):
                sz    = 0.9 if i == 0 else 0.65
                col   = (255, 200, 50) if i == 0 else COL_TEXT
                (tw, th), _ = cv2.getTextSize(line, FONT, sz, 2)
                cx_   = (w - tw) // 2
                cv2.putText(canvas, line, (cx_, y0 + i * 35),
                            FONT, sz, col, 2, cv2.LINE_AA)

            lm = self.tracker.process_frame(frame)
            hx = hy = float("nan")
            inside = False
            if lm:
                hx, hy = FaceMeshTracker.head_center(lm)
                inside = self._head_inside_box(hx, hy)

            self._ui.camera_preview_with_headlock(
                canvas, frame, hx, hy, inside,
                face_detected=(lm is not None))

            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            if cv2.waitKey(30) == 32:
                break

    # ── wait until head is steady inside the box ─────────────────────────
    def _wait_for_head_inside(self, cap, phase_text: str) -> bool:
        """Blocks until the head has been inside the box for
        HEAD_CENTER_MIN_HOLD_S seconds. Returns False if aborted."""
        hold_start = None
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            h, w  = frame.shape[:2]
            canvas = self._ui.blank(w, h)

            lm = self.tracker.process_frame(frame)
            hx = hy = float("nan")
            inside = False
            if lm:
                hx, hy = FaceMeshTracker.head_center(lm)
                inside = self._head_inside_box(hx, hy)

            now = time.time()
            if inside:
                if hold_start is None:
                    hold_start = now
                held = now - hold_start
                remaining = max(0.0, HEAD_CENTER_MIN_HOLD_S - held)
                self._ui.status_bar(
                    canvas,
                    f"{phase_text} — hold position ({remaining:.1f}s)",
                    COL_GOOD)
                if held >= HEAD_CENTER_MIN_HOLD_S:
                    self._ui.camera_preview_with_headlock(
                        canvas, frame, hx, hy, inside,
                        face_detected=(lm is not None))
                    cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
                    cv2.waitKey(1)
                    return True
            else:
                hold_start = None
                self._ui.status_bar(
                    canvas,
                    f"{phase_text} — move head inside the box",
                    COL_WARN, 0.95)

            self._ui.camera_preview_with_headlock(
                canvas, frame, hx, hy, inside,
                face_detected=(lm is not None))

            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            if cv2.waitKey(1) == 27:   # ESC
                return False

    # ── single trial ──────────────────────────────────────────────────────
    def _run_trial(self, cap, trial_id: int, side: str) -> Optional[TrialResult]:
        # ensure head is locked before we begin
        if not self._wait_for_head_inside(cap, f"Trial {trial_id}/{self.n_trials}"):
            return None

        fixation_pts: List[GazePoint] = []
        stim_pts    : List[GazePoint] = []
        head_moved  = False
        h_ref, w_ref = 720, 1280   # safe defaults; updated on first frame

        # ── Phase 1: Fixation ────────────────────────────────────────────
        end_fix = time.time() + FIXATION_DURATION_S
        while time.time() < end_fix:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            h_ref, w_ref = frame.shape[:2]
            canvas = self._ui.blank(w_ref, h_ref)
            self._ui.fixation_cross(canvas, w_ref // 2, h_ref // 2)
            self._ui.status_bar(
                canvas,
                f"Trial {trial_id}/{self.n_trials}  ·  Look at the cross")
            self._ui.progress_bar(canvas, trial_id - 1, self.n_trials)

            t  = time.time()
            gp = self._read_gaze(frame, t, trial_id, "fixation", "none")
            fixation_pts.append(gp)
            if not gp.head_inside:
                head_moved = True
            if gp.face_detected and not math.isnan(gp.norm_x):
                self._ui.gaze_dot(canvas, gp.norm_x, gp.norm_y)

            self._ui.camera_preview_with_headlock(
                canvas, frame, gp.head_x, gp.head_y, gp.head_inside,
                face_detected=gp.face_detected)

            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            cv2.waitKey(1)

        # ── Phase 2: Stimulus ────────────────────────────────────────────
        stim_onset_s = time.time()
        stim_x       = self._get_stim_x(side, w_ref)
        end_stim     = stim_onset_s + RESPONSE_WINDOW_S
        correct_target_x = +0.7 if side == "left" else -0.7

        live_label, live_col = "…", COL_TEXT

        while time.time() < end_stim:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
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

            t  = time.time()
            gp = self._read_gaze(frame, t, trial_id, "stimulus", side)
            stim_pts.append(gp)
            if not gp.head_inside:
                head_moved = True
            if gp.face_detected and not math.isnan(gp.norm_x):
                self._ui.gaze_dot(canvas, gp.norm_x, gp.norm_y)
                if gp.norm_x < -0.15:
                    live_label, live_col = "LOOKING LEFT", COL_GAZE
                elif gp.norm_x > 0.15:
                    live_label, live_col = "LOOKING RIGHT", COL_GAZE
                else:
                    live_label, live_col = "CENTERED", COL_TEXT

            self._ui.camera_preview_with_headlock(
                canvas, frame, gp.head_x, gp.head_y, gp.head_inside,
                face_detected=gp.face_detected)

            self._ui.gaze_vs_target_bar(
                canvas,
                gp.norm_x if not math.isnan(gp.norm_x) else float("nan"),
                correct_target_x,
                f"Your gaze (●)   vs.   Correct target (▮)   ·   {live_label}",
                live_col)

            # ── debug numeric overlay (must be drawn BEFORE imshow) ──
            self._ui.debug_overlay(
                canvas,
                gp.norm_x if not math.isnan(gp.norm_x) else float("nan"),
                gp.norm_y if not math.isnan(gp.norm_y) else float("nan"),
                "…", live_label)

            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            cv2.waitKey(1)

        # ── Biomarkers ───────────────────────────────────────────────────
        all_trial_pts = fixation_pts + stim_pts
        self.all_points.extend(all_trial_pts)

        # Require BOTH axes to be finite, otherwise downstream math (velocity,
        # RMSD) produces NaN and the trial is silently mis-classified.
        valid_fix  = [p for p in fixation_pts
                      if p.face_detected
                      and not math.isnan(p.norm_x)
                      and not math.isnan(p.norm_y)]
        valid_stim = [p for p in stim_pts
                      if p.face_detected
                      and not math.isnan(p.norm_x)
                      and not math.isnan(p.norm_y)]

        rmsd = BiomarkerEngine.fixation_rmsd(valid_fix)
        is_err, lat_ms, first_vel, first_dir, resp_label = \
            BiomarkerEngine.classify_trial(stim_onset_s, side, valid_stim)

        result = TrialResult(
            trial_id          = trial_id,
            stimulus_side     = side,
            correct_side      = "left" if side == "right" else "right",
            is_error          = is_err,
            latency_ms        = lat_ms,
            first_velocity    = first_vel,
            fixation_rmsd     = rmsd,
            frames_collected  = len(all_trial_pts),
            first_saccade_dir = first_dir,
            response_label    = resp_label,
            head_moved        = head_moved,
        )

        # ── Post-trial feedback banner ───────────────────────────────────
        banner_col = {"correct": COL_GOOD, "error": COL_BAD,
                      "no_response": COL_WARN}[resp_label]
        banner_txt = {"correct": "CORRECT  ✓",
                      "error"  : "WRONG SIDE  ✗",
                      "no_response": "NO EYE MOVEMENT DETECTED"}[resp_label]

        fb_end = time.time() + 0.8
        while time.time() < fb_end:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            canvas = self._ui.blank(w_ref, h_ref)
            self._ui.outcome_badge(canvas, banner_txt, banner_col)
            info = (f"Trial {trial_id} · stimulus={side.upper()} · "
                    f"first saccade={first_dir} · "
                    + (f"latency={lat_ms:.0f}ms" if not math.isnan(lat_ms)
                       else "latency=N/A"))
            self._ui.status_bar(canvas, info, COL_TEXT, 0.85)
            self._ui.camera_preview_with_headlock(
                canvas, frame, float("nan"), float("nan"), True,
                face_detected=True)
            cv2.imshow("CogniSense — Oculomotor Assessment", canvas)
            cv2.waitKey(1)

        rmsd_str = f"{rmsd:.4f}" if not math.isnan(rmsd) else "  N/A "
        lat_str  = f"{lat_ms:6.1f}" if not math.isnan(lat_ms) else "   N/A"
        print(f"  Trial {trial_id:2d} | stim={side:5s} | "
              f"{resp_label:11s} | first={first_dir:5s} | "
              f"latency={lat_str}ms | rmsd={rmsd_str} | "
              f"head_moved={head_moved}")
        return result

    # ── main entry point ──────────────────────────────────────────────────
    def run(self):
        cap = self._open_camera()
        cv2.namedWindow("CogniSense — Oculomotor Assessment", cv2.WINDOW_NORMAL)
        cv2.setWindowProperty("CogniSense — Oculomotor Assessment",
                              cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
        try:
            if not self._show_calibration_ready(cap):
                return
            self.run_calibration(cap)
            self._show_instructions(cap)

            sides = (["left"] * (self.n_trials // 2)
                     + ["right"] * (self.n_trials // 2))
            random.shuffle(sides)
            self.trial_sides = sides

            print("\n[INFO] Beginning antisaccade task...\n")
            for tid, side in enumerate(sides, start=1):
                result = self._run_trial(cap, tid, side)
                if result is not None:
                    self.trial_results.append(result)
                time.sleep(0.3)
        finally:
            cap.release()
            cv2.destroyAllWindows()