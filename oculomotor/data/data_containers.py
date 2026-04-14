"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 Data containers for gaze points and trial results
================================================================================
"""

from dataclasses import dataclass


@dataclass
class GazePoint:
    """One frame's normalised gaze measurement."""
    timestamp_s  : float
    trial_id     : int
    phase        : str           # "fixation" | "stimulus" | "calibration" | "pursuit"
    stimulus_side: str           # "left" | "right" | "none"
    norm_x       : float         # –1 (far left) … +1 (far right)
    norm_y       : float         # –1 (top)       … +1 (bottom)
    raw_lx       : float         # raw left-iris pixel x (normalised 0-1 by MP)
    raw_ly       : float
    face_detected: bool


@dataclass
class TrialResult:
    """Biomarker summary for a single antisaccade trial."""
    trial_id        : int
    stimulus_side   : str
    correct_side    : str           # opposite of stimulus
    is_error        : bool          # True = first saccade towards stimulus
    latency_ms      : float         # ms to correct saccade (NaN if error)
    first_velocity  : float         # deg/s of first detected saccade
    fixation_rmsd   : float         # RMSD during fixation window
    frames_collected: int