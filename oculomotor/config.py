"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 Global constants & configuration
================================================================================
"""

from pathlib import Path

# ══════════════════════════════════════════════════════════════════════════════
#  MediaPipe landmark indices
# ══════════════════════════════════════════════════════════════════════════════

# Left iris  : 468, 469, 470, 471, 472   (centre + 4 cardinal boundary pts)
# Right iris : 473, 474, 475, 476, 477
# Left eye corners  : inner=133 , outer=33
# Right eye corners : inner=362 , outer=263
Liris_CENTRE      = 468
Riris_CENTRE      = 473
Liris_INDICES     = [468, 469, 470, 471, 472]
Riris_INDICES     = [473, 474, 475, 476, 477]
L_INNER_CORNER    = 133
L_OUTER_CORNER    = 33
R_INNER_CORNER    = 362
R_OUTER_CORNER    = 263

# full index lists (5 points per iris for centroid averaging)
LIRS_INDICES_FULL = [468, 469, 470, 471, 472]
RIRS_INDICES_FULL = [473, 474, 475, 476, 477]

# ══════════════════════════════════════════════════════════════════════════════
#  Task parameters
# ══════════════════════════════════════════════════════════════════════════════

ANTISACCADE_TRIALS      = 8        # number of antisaccade trials
FIXATION_DURATION_S     = 3        # fixation cross shown for N seconds
RESPONSE_WINDOW_S       = 2.0         # data-recording window after stimulus
STIMULUS_OFFSET_PX      = 400         # horizontal offset from screen centre
CALIBRATION_DURATION_S  = 5.0         # neutral-look calibration window
SACCADE_VELOCITY_DEG_S  = 30.0        # velocity threshold (°/s) for a saccade
ERROR_WINDOW_MS         = 500         # window after stimulus to detect errors
CAMERA_FOV_DEG          = 60.0        # approximate horizontal camera FOV (°)

# ══════════════════════════════════════════════════════════════════════════════
#  Smooth pursuit
# ══════════════════════════════════════════════════════════════════════════════

PURSUIT_CYCLES          = 3           # horizontal sinusoidal cycles
PURSUIT_DURATION_S      = 6.0         # total pursuit task duration

# ══════════════════════════════════════════════════════════════════════════════
#  Output paths
# ══════════════════════════════════════════════════════════════════════════════

OUT_DIR                 = Path("oculomotor_output")
RAW_CSV                 = OUT_DIR / "raw_gaze_timeseries.csv"
ANTISACCADE_CSV         = OUT_DIR / "antisaccade_raw_data.csv"
SUMMARY_JSON            = OUT_DIR / "oculomotor_report.json"
PLOT_PATH               = OUT_DIR / "gaze_path_trials.png"
CALIBRATION_LOG         = OUT_DIR / "calibration_baseline.json"

# ══════════════════════════════════════════════════════════════════════════════
#  UI colours (BGR)
# ══════════════════════════════════════════════════════════════════════════════

COL_BG          = (15,  15,  15)
COL_CROSS       = (220, 220, 220)
COL_STIMULUS    = (30,  30,  220)    # red dot
COL_PURSUIT_DOT = (30,  220,  30)    # green dot
COL_TEXT        = (200, 200, 200)
COL_WARN        = (30,   80, 220)    # orange for warnings
COL_GOOD        = (30,  180,  30)    # green for ok status