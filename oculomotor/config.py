"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 Configuration constants
================================================================================
"""

from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR         = Path(__file__).resolve().parent
OUTPUT_DIR       = BASE_DIR / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
CALIBRATION_LOG  = OUTPUT_DIR / "calibration.json"
SUMMARY_JSON     = OUTPUT_DIR / "summary.json"
PLOT_PATH        = OUTPUT_DIR / "dashboard.png"

# ── Camera ────────────────────────────────────────────────────────────────────
CAMERA_FOV_DEG   = 60.0          # horizontal FOV of the webcam (degrees)

# ── Calibration ───────────────────────────────────────────────────────────────
CALIBRATION_DURATION_S = 5.0

# ── Antisaccade task ──────────────────────────────────────────────────────────
ANTISACCADE_TRIALS     = 10
FIXATION_DURATION_S    = 1.5
RESPONSE_WINDOW_S      = 1.5
STIMULUS_OFFSET_PX     = 300
SACCADE_VELOCITY_DEG_S = 30.0    # threshold to call something a saccade
ERROR_WINDOW_MS        = 700.0   # first saccade after stimulus decides error

# ── Smooth pursuit task ───────────────────────────────────────────────────────
PURSUIT_CYCLES         = 5
PURSUIT_DURATION_S     = 10.0

# ── Head-lock ─────────────────────────────────────────────────────────────────
HEAD_BOX_W_FRAC        = 0.32     # fraction of frame width
HEAD_BOX_H_FRAC        = 0.42     # fraction of frame height
HEAD_BOX_TOLERANCE     = 0.05     # slack before we consider head "out"
HEAD_CENTER_MIN_HOLD_S = 0.6      # must hold inside box this long to begin trial

# ── Colours (BGR) ─────────────────────────────────────────────────────────────
COL_BG          = (18, 18, 32)
COL_CROSS       = (230, 230, 230)
COL_STIMULUS    = (60, 60, 230)   # red
COL_PURSUIT_DOT = (80, 230, 80)   # green
COL_TEXT        = (240, 240, 240)
COL_GOOD        = (80, 200, 80)
COL_WARN        = (60, 180, 240)
COL_BAD         = (60, 60, 230)
COL_GAZE        = (255, 255, 0)   # cyan — live gaze estimate
COL_TARGET      = (80, 230, 80)   # green — pursuit target
COL_HEADBOX     = (180, 180, 180)
COL_HEADBOX_OK  = (80, 220, 80)
COL_HEADBOX_BAD = (60, 60, 230)

# ══════════════════════════════════════════════════════════════════════════════
# MediaPipe FaceMesh landmark indices (478-landmark iris-refined model)
# ══════════════════════════════════════════════════════════════════════════════

# ── Eye corners ───────────────────────────────────────────────────────────────
# Left eye = subject's LEFT eye (image-right in a mirrored frame)
# Right eye = subject's RIGHT eye (image-left in a mirrored frame)
L_INNER_CORNER = 133       # left eye, inner corner (toward nose)
L_OUTER_CORNER = 33        # left eye, outer corner (toward ear)
R_INNER_CORNER = 362       # right eye, inner corner (toward nose)
R_OUTER_CORNER = 263       # right eye, outer corner (toward ear)

# ── Iris landmark indices (refine_landmarks=True) ─────────────────────────────
# MediaPipe adds 10 iris landmarks: 468–472 = LEFT iris, 473–477 = RIGHT iris.
# Each iris is a 5-point ring: centre is index 468 (left) / 473 (right).
L_IRIS_CENTER  = 468
R_IRIS_CENTER  = 473

LIRS_INDICES_FULL = [468, 469, 470, 471, 472]   # left iris ring
RIRS_INDICES_FULL = [473, 474, 475, 476, 477]   # right iris ring

# ── Face bounding landmarks (for head-pose fallback / box drawing) ────────────
NOSE_TIP       = 1
CHIN           = 152
FOREHEAD_TOP   = 10
LEFT_CHEEK     = 234
RIGHT_CHEEK    = 454

# ── Optional: debug flag ──────────────────────────────────────────────────────
DEBUG_MODE     = False