"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 main.py — runs both tasks and produces the final score + 6-class label
================================================================================
"""

import sys
from .tracking.face_mesh_tracker  import FaceMeshTracker
from .calibration.calibration_engine import CalibrationEngine
from .tasks.antisaccade_task      import AntisaccadeTask
from .tasks.smooth_pursuit_task   import SmoothPursuitTask
from .analysis.report_generator   import ReportGenerator


def main():
    cal = CalibrationEngine()

    with FaceMeshTracker() as tracker:
        # ── Antisaccade ──────────────────────────────────────────────────
        anti = AntisaccadeTask(tracker, cal)
        anti.run()

        # ── Smooth pursuit (optional) ────────────────────────────────────
        pursuit_gain = float("nan")
        try:
            pursuit = SmoothPursuitTask(tracker, cal)
            pursuit.run()
            pursuit_gain = pursuit.gain
        except Exception as e:
            print(f"[WARN] Smooth pursuit skipped: {e}")

    # ── Aggregate + report ──────────────────────────────────────────────
    rpt = ReportGenerator()
    session = rpt.build_session(anti.trial_results, pursuit_gain)
    report  = rpt.generate_summary(session)
    rpt.save_json(report)
    rpt.plot_gaze_paths(session, anti.all_points)


if __name__ == "__main__":
    main()