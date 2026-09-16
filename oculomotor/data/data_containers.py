"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 Data containers
================================================================================
"""

from dataclasses import dataclass, field
from typing import Tuple, List


@dataclass
class GazePoint:
    """One frame's normalised gaze measurement."""
    timestamp_s  : float
    trial_id     : int
    phase        : str            # "fixation" | "stimulus" | "calibration" | "pursuit"
    stimulus_side: str            # "left" | "right" | "none"
    norm_x       : float          # -1 … +1 (left … right)
    norm_y       : float          # -1 … +1 (top  … bottom)
    raw_lx       : float
    raw_ly       : float
    face_detected: bool
    # NEW: head position (normalised to frame) for the head-lock check.
    head_x       : float = float("nan")
    head_y       : float = float("nan")
    head_inside  : bool  = False


@dataclass
class TrialResult:
    """Biomarker summary for a single antisaccade trial."""
    trial_id         : int
    stimulus_side    : str
    correct_side     : str
    is_error         : bool
    latency_ms       : float
    first_velocity   : float
    fixation_rmsd    : float
    frames_collected : int
    # NEW: explained outcome
    first_saccade_dir: str = "none"     # "left" / "right" / "none"
    response_label   : str = "no_response"   # "correct" | "error" | "no_response"
    head_moved       : bool = False          # True if head left the box mid-trial


@dataclass
class SessionResult:
    """Aggregated result across the whole session."""
    n_trials        : int
    n_errors        : int
    n_no_response   : int
    error_rate      : float
    mean_latency_ms : float
    mean_rmsd       : float
    pursuit_gain    : float
    score           : float            # 0 – 100
    class_label     : str              # one of six classes
    class_confidence: float            # 0 – 1
    trial_results   : List[TrialResult] = field(default_factory=list)