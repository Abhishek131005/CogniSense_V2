"""
================================================================================
 Scripted trial trace.

 Run:  python -m oculomotor.debug.trial_trace

 Presents a fixed sequence of prompts (configurable below) and, for each:
   • records all gaze points,
   • saves annotated snapshot PNGs (start / peak / end) with landmarks drawn,
   • prints what the tracker reported (min / max / range of norm_x),
   • compares against the expected direction.

 Output goes to  oculomotor/output/debug_trace/<run_timestamp>/
================================================================================
"""

import json
import time
from pathlib import Path
import cv2
import numpy as np

from ..config import OUTPUT_DIR
from ..tracking.face_mesh_tracker import FaceMeshTracker
from ..analysis.biomarker_engine import BiomarkerEngine
from ..data.data_containers import GazePoint
from .iris_visualizer import _draw_landmarks, FONT


# ── Edit this to test any scenario you want ──────────────────────────────────
SEGMENTS = [
    # (instruction, seconds, expected_direction)
    ("CENTER",         2.0, "none"),
    ("LOOK LEFT",      2.0, "left"),
    ("CENTER",         1.0, "none"),
    ("LOOK RIGHT",     2.0, "right"),
    ("CENTER",         1.0, "none"),
    ("BLINK 3 TIMES",  2.0, "none"),
    ("CENTER",         1.0, "none"),
    ("LOOK LEFT",      1.5, "left"),
    ("LOOK RIGHT",     1.5, "right"),   # hold-and-switch scenario
]


class TrialTracer:

    def __init__(self, camera_index=0):
        self.cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        self.run_dir = OUTPUT_DIR / "debug_trace" / \
            time.strftime("%Y%m%d_%H%M%S")
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.tracker = FaceMeshTracker()
        self.report = []

    def _annotate(self, frame, lm, w, h, prompt, expected, actual_nx):
        img = frame.copy()
        if lm is not None:
            _draw_landmarks(img, lm, w, h)
        cv2.rectangle(img, (0, 0), (w, 90), (0, 0, 0), -1)
        cv2.putText(img, f"PROMPT: {prompt}   expected={expected}",
                    (20, 40), FONT, 0.9, (255, 255, 255), 2)
        cv2.putText(img, f"norm_x = {actual_nx:+.3f}",
                    (20, 78), FONT, 0.8, (255, 255, 0), 2)
        return img

    def _run_segment(self, prompt, duration_s, expected):
        pts = []  # list of (t, nx, ny, frame, lm, w, h)
        t0 = time.time()
        end = t0 + duration_s
        prev_time = time.time()
        while time.time() < end:
            ret, frame = self.cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]

            lm = self.tracker.process_frame(frame)
            nx = ny = float("nan")
            if lm is not None:
                nx, ny, _, _ = FaceMeshTracker.extract_gaze(lm, w, h)

            pts.append({
                "t": time.time() - t0, "nx": nx, "ny": ny,
                "frame": frame.copy(), "lm": lm, "w": w, "h": h,
            })

            show = self._annotate(frame, lm, w, h, prompt, expected, nx)
            remain = max(0.0, end - time.time())
            cv2.putText(show, f"{remain:4.1f}s", (w - 130, 78),
                        FONT, 0.9, (255, 255, 255), 2)
            cv2.imshow("Trial Trace", show)
            if cv2.waitKey(1) & 0xFF == 27:      # ESC
                return None
            prev_time = time.time()
        return pts

    def run(self):
        print(f"[INFO] Saving debug artefacts to: {self.run_dir}")
        with self.tracker:
            for i, (prompt, dur, expected) in enumerate(SEGMENTS):
                print(f"\n[SEGMENT {i+1}/{len(SEGMENTS)}] {prompt} "
                      f"({dur}s, expect {expected})")
                pts = self._run_segment(prompt, dur, expected)
                if pts is None:
                    print("[INFO] Aborted by user.")
                    return

                valid = [p for p in pts if not np.isnan(p["nx"])]
                if not valid:
                    print("  no valid samples")
                    continue
                xs = np.array([p["nx"] for p in valid])
                ys = np.array([p["ny"] for p in valid])

                # find peak-time frame
                peak_idx = int(np.argmax(np.abs(xs)))
                start_f = pts[0]
                peak_f  = valid[peak_idx]
                end_f   = pts[-1]

                for label, p in [("start", start_f), ("peak", peak_f),
                                 ("end", end_f)]:
                    if p["lm"] is None:
                        continue
                    ann = self._annotate(p["frame"], p["lm"], p["w"], p["h"],
                                         prompt, expected, p["nx"])
                    path = self.run_dir / \
                        f"seg{i+1:02d}_{label}_{prompt.replace(' ','_')}.png"
                    cv2.imwrite(str(path), ann)

                # build GazePoint list for the biomarker engine
                gps = [GazePoint(p["t"], i, "stimulus", "none",
                                 p["nx"], p["ny"], 0, 0, True) for p in valid]
                events = BiomarkerEngine.detect_saccades(gps)

                seg_report = {
                    "segment": i + 1,
                    "prompt": prompt,
                    "expected": expected,
                    "duration_s": dur,
                    "n_valid_samples": len(valid),
                    "norm_x_min": float(xs.min()),
                    "norm_x_max": float(xs.max()),
                    "norm_x_mean": float(xs.mean()),
                    "norm_x_std": float(xs.std()),
                    "norm_x_range": float(xs.max() - xs.min()),
                    "norm_y_min": float(ys.min()),
                    "norm_y_max": float(ys.max()),
                    "saccade_events": len(events),
                    "saccade_dirs": [e[2] for e in events],
                }
                self.report.append(seg_report)
                print(f"  norm_x range = [{xs.min():+.3f}, {xs.max():+.3f}]  "
                      f"range={xs.max()-xs.min():.3f}  std={xs.std():.3f}")
                print(f"  saccades detected: {len(events)}  "
                      f"dirs={[e[2] for e in events]}")

        # save machine-readable report
        (self.run_dir / "trace_report.json").write_text(
            json.dumps(self.report, indent=2))
        self._print_table()
        print(f"\n[INFO] Full report → {self.run_dir / 'trace_report.json'}")

    def _print_table(self):
        print("\n" + "=" * 84)
        print(" SEGMENT TRACE SUMMARY")
        print("=" * 84)
        print(f" {'#':>2} {'prompt':<18} {'expected':<9} "
              f"{'min':>7} {'max':>7} {'range':>7} "
              f"{'std':>6} {'sacc':>4} {'dirs'}")
        print("-" * 84)
        for r in self.report:
            print(f" {r['segment']:>2} {r['prompt']:<18} "
                  f"{r['expected']:<9} "
                  f"{r['norm_x_min']:>+7.3f} {r['norm_x_max']:>+7.3f} "
                  f"{r['norm_x_range']:>7.3f} "
                  f"{r['norm_x_std']:>6.3f} "
                  f"{r['saccade_events']:>4} {r['saccade_dirs']}")
        print("=" * 84)
        print(" How to read this:")
        print("  • 'LOOK LEFT' segment must have norm_x_min < -0.20.")
        print("  • 'LOOK RIGHT' segment must have norm_x_max > +0.20.")
        print("  • 'CENTER' segments should have |range| < 0.15.")
        print("  • 'BLINK' segment may show spurious saccades — if it does,")
        print("    add a NaN-filter for low-confidence frames.")
        print("=" * 84)

    def close(self):
        self.cap.release()
        cv2.destroyAllWindows()


def run():
    t = TrialTracer()
    try:
        t.run()
    finally:
        t.close()


if __name__ == "__main__":
    run()