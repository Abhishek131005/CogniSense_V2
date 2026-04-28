"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 Orchestrator - Main entry point
================================================================================
"""

import time
from .config import (
    OUT_DIR, ANTISACCADE_TRIALS, RAW_CSV, ANTISACCADE_CSV,
    SUMMARY_JSON, PLOT_PATH
)
from .tracking import FaceMeshTracker
from .calibration import CalibrationEngine
from .tasks import AntisaccadeTask, SmoothPursuitTask
from .data import DataArchive
from .analysis import ReportGenerator


def main():
    """
    Full CogniSense Oculomotor Assessment pipeline.

    Steps
    ─────
    1.  Initialise FaceMeshTracker + CalibrationEngine
    2.  Run Antisaccade Task (20 trials)
    3.  Run Smooth Pursuit Task (optional — press Q to skip)
    4.  Save raw CSV artefacts
    5.  Compute and display clinical report (JSON)
    6.  Render matplotlib visualisation
    """
    print(
        "\n"
        "+----------------------------------------------------------+\n"
        "|      CogniSense - Oculomotor Diagnostic Module          |\n"
        "|      Pre-clinical Alzheimer's Screening Tool            |\n"
        "+----------------------------------------------------------+\n"
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    calibration = CalibrationEngine()

    with FaceMeshTracker() as tracker:

        # ── Phase A: Antisaccade ──────────────────────────────────────────
        print("[INFO] Phase A - Antisaccade Task")
        antisaccade = AntisaccadeTask(tracker, calibration,
                                      n_trials=ANTISACCADE_TRIALS)
        antisaccade.run()

        # ── Phase B: Smooth Pursuit (optional) ────────────────────────────
        pursuit_gain = float("nan")
        print("\n[INFO] Phase B - Smooth Pursuit (press Q in next 3s to skip)")
        time.sleep(1)
        # Non-blocking check: we just proceed; user can close window if desired
        try:
            pursuit_task = SmoothPursuitTask(tracker, calibration)
            pursuit_task.run()
            pursuit_gain = pursuit_task.gain
            all_gaze_pts = antisaccade.all_points + pursuit_task.pursuit_pts
        except Exception as e:
            print(f"[WARN] Smooth pursuit skipped: {e}")
            all_gaze_pts = antisaccade.all_points

    # ── Persist raw data ──────────────────────────────────────────────────
    print("\n[INFO] Saving data artefacts...")
    DataArchive.save_raw(all_gaze_pts, RAW_CSV)
    DataArchive.save_antisaccade(antisaccade.all_points, ANTISACCADE_CSV)

    # ── Generate report ───────────────────────────────────────────────────
    reporter = ReportGenerator()
    report   = reporter.generate_summary(antisaccade.trial_results,
                                         pursuit_gain)
    reporter.save_json(report, SUMMARY_JSON)

    # ── Visualise ─────────────────────────────────────────────────────────
    print("\n[INFO] Rendering visualisation...")
    reporter.plot_gaze_paths(antisaccade.trial_results,
                             antisaccade.all_points, PLOT_PATH)

    print(f"\n[DONE] All outputs saved in:  {OUT_DIR.resolve()}/")
    print("       ├── raw_gaze_timeseries.csv")
    print("       ├── antisaccade_raw_data.csv")
    print("       ├── oculomotor_report.json")
    print("       ├── gaze_path_trials.png")
    print("       └── calibration_baseline.json")


if __name__ == "__main__":
    main()