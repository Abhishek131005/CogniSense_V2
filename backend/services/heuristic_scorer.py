"""
backend/services/heuristic_scorer.py

Rule-based CDT scoring engine.

Produces a raw risk score (0–100) by combining image features (from OpenCV)
and dynamic motor features (from the frontend JSON payload).

Scoring rubric is based on the Shulman / Rouleau CDT scoring scales adapted
for digital administration:

  HIGHER score = MORE cognitive risk (worse performance)

Visual Criteria (60 pts total):
  - Quadrant coverage (all 4 quadrants have content)   → 0–20 pts
  - Estimated number completeness (12 numerals)        → 0–20 pts
  - Hand presence (2 lines from center)                → 0–15 pts
  - Stroke spread (drawing uses full clock area)        → 0–5 pts

Dynamic/Motor Criteria (40 pts total):
  - Pause count ≥ 3                                    → +10 each, max 20 pts
  - Total pause duration > 8s                          → +10 pts
  - Revision (undo) count                              → +5 each, max 15 pts
  - Drawing duration > 3 mins                          → +5 pts
  - Time accuracy error (> 25 degrees)                 → +15 pts
"""


def standardize_angle(angle: float) -> float:
    """Wrap angle to [-180, 180] range."""
    return (angle + 180) % 360 - 180


def angle_diff(a1: float, a2: float) -> float:
    """Shortest distance in degrees between two angles."""
    return abs(standardize_angle(a1 - a2))


def compute_heuristic_score(image_features: dict, dynamic_features: dict) -> dict:
    """
    Combine image and dynamic features into a single 0–100 risk score.

    Args:
        image_features: dict from image_analyzer.extract_image_features()
        dynamic_features: dict from ScoringRequest.features (frontend JSON)
    
    Returns:
        dict with 'heuristic_score' (0–100) and 'penalties' breakdown
    """
    penalties = {}
    total_penalty = 0.0

    # ── Visual penalties (higher penalty = worse clock) ────────────────────────

    # 1. Quadrant coverage — if <2 of 4 quadrants filled = severely impaired
    qc = image_features.get("quadrant_coverage", 0)
    qc_penalty = (1.0 - qc) * 25  # 0–25 pts
    penalties["quadrant_missing"] = round(qc_penalty, 1)
    total_penalty += qc_penalty

    # 2. Estimated number completeness
    en = image_features.get("estimated_numbers", 0)
    num_penalty = (1.0 - en) * 20  # 0–20 pts
    penalties["numbers_missing"] = round(num_penalty, 1)
    total_penalty += num_penalty

    # 3. Hand detection
    hc = image_features.get("hand_count_norm", 0)
    hand_penalty = (1.0 - hc) * 15  # 0–15 pts
    penalties["hands_missing"] = round(hand_penalty, 1)
    total_penalty += hand_penalty

    # 4. Stroke spread — if drawing is cramped / small
    ss = image_features.get("stroke_spread", 0)
    spread_penalty = max(0, (0.25 - ss)) * 20  # penalty if spread < 25%
    penalties["stroke_cramped"] = round(spread_penalty, 1)
    total_penalty += spread_penalty

    # 5. Ink density — near-empty canvas = incomplete drawing
    # Mathematical baseline: The empty clock outline circle is ~0.85% of the canvas area.
    density = image_features.get("ink_density", 0)
    if density < 0.008:     # < 0.8% (literally just the circle)
        density_penalty = 20.0  
    elif density < 0.010:   # < 1.0% (circle + 1-2 faint strokes missing most items)
        density_penalty = 10.0
    else:
        density_penalty = 0.0
    penalties["ink_density_low"] = round(density_penalty, 1)
    total_penalty += density_penalty

    # ── Dynamic / motor penalties ──────────────────────────────────────────────

    # 6. Pause count
    pause_count = dynamic_features.get("pauseCount", 0)
    pause_penalty = min(pause_count * 5, 15)  # 0–15 pts
    penalties["pause_frequency"] = round(pause_penalty, 1)
    total_penalty += pause_penalty

    # 7. Total pause duration
    total_pause_ms = dynamic_features.get("totalPauseDurationMs", 0)
    if total_pause_ms > 15_000:
        pause_dur_penalty = 10.0
    elif total_pause_ms > 8_000:
        pause_dur_penalty = 5.0
    else:
        pause_dur_penalty = 0.0
    penalties["pause_duration"] = round(pause_dur_penalty, 1)
    total_penalty += pause_dur_penalty

    # 8. Revision count (undo presses)
    revisions = dynamic_features.get("revisionCount", 0)
    revision_penalty = min(revisions * 4, 12)  # 0–12 pts
    penalties["revision_count"] = round(revision_penalty, 1)
    total_penalty += revision_penalty

    # 9. Drawing duration (> 3 min is clinically flagged)
    duration_ms = dynamic_features.get("totalDurationMs", 0)
    if duration_ms > 300_000:  # 5 mins
        dur_penalty = 8.0
    elif duration_ms > 180_000:  # 3 mins
        dur_penalty = 4.0
    else:
        dur_penalty = 0.0
    penalties["prolonged_duration"] = round(dur_penalty, 1)
    total_penalty += dur_penalty

    # 10. Time accuracy verification
    target_h = dynamic_features.get("targetHour", 11)
    target_m = dynamic_features.get("targetMinute", 10)
    
    # 0 deg = 3 o'clock, +90 deg = 6 o'clock, -90 = 12 o'clock
    expected_m_angle = standardize_angle((target_m * 6) - 90)
    expected_h_angle = standardize_angle(((target_h % 12) * 30 + (target_m / 2)) - 90)
    
    hand_angles = image_features.get("hand_angles", [])
    time_penalty = 0.0
    
    # Only verify time if at least 2 hands were actually detected
    if len(hand_angles) >= 2:
        # We don't know which drawn hand is the hour vs minute hand, so test both mappings
        a1, a2 = hand_angles[0], hand_angles[1]
        
        diff_scenario_1 = angle_diff(a1, expected_m_angle) + angle_diff(a2, expected_h_angle)
        diff_scenario_2 = angle_diff(a2, expected_m_angle) + angle_diff(a1, expected_h_angle)
        
        avg_err = min(diff_scenario_1, diff_scenario_2) / 2.0
        
        if avg_err > 25:  # Over 25 degrees off on average
            time_penalty = 15.0
        elif avg_err > 15:
            time_penalty = 5.0
            
    penalties["incorrect_time"] = round(time_penalty, 1)
    total_penalty += time_penalty

    # ── Clamp to 0–100 ─────────────────────────────────────────────────────────
    heuristic_score = round(min(100.0, max(0.0, total_penalty)), 2)

    return {
        "heuristic_score": heuristic_score,
        "penalties": penalties,
    }


def derive_flags(image_features: dict, dynamic_features: dict, score: float) -> list[str]:
    """Derive up to 3 clinical flags from features for the result report."""
    flags = []

    qc = image_features.get("quadrant_coverage", 1)
    if qc < 0.5:
        flags.append("Incomplete quadrant coverage — numbers may be missing or misplaced")

    hc = image_features.get("hand_count_norm", 1)
    if hc < 0.25:   # only flag when ZERO hands detected (not just 1)
        flags.append("Clock hands absent or not detected — hand placement impaired")


    en = image_features.get("estimated_numbers", 1)
    if en < 0.4:
        flags.append("Low estimated numeral count — visuospatial construction impaired")
        
    hand_angles = image_features.get("hand_angles", [])
    if len(hand_angles) >= 2:
        target_h = dynamic_features.get("targetHour", 11)
        target_m = dynamic_features.get("targetMinute", 10)
        expected_m_angle = standardize_angle((target_m * 6) - 90)
        expected_h_angle = standardize_angle(((target_h % 12) * 30 + (target_m / 2)) - 90)
        
        a1, a2 = hand_angles[0], hand_angles[1]
        diff_1 = angle_diff(a1, expected_m_angle) + angle_diff(a2, expected_h_angle)
        diff_2 = angle_diff(a2, expected_m_angle) + angle_diff(a1, expected_h_angle)
        if min(diff_1, diff_2) / 2.0 > 25:
            flags.append("Hands point to incorrect time — severe visuospatial or executive impairment")

    if dynamic_features.get("pauseCount", 0) >= 3:
        flags.append("Elevated pause frequency — executive planning hesitation")

    if dynamic_features.get("totalPauseDurationMs", 0) > 8000:
        flags.append("High total pause duration — possible executive dysfunction")

    if dynamic_features.get("revisionCount", 0) >= 3:
        flags.append("High revision count — visuospatial uncertainty")

    if dynamic_features.get("meanStrokeVelocity", 100) < 20:
        flags.append("Low stroke velocity — reduced motor fluency")

    if dynamic_features.get("velocityStdDev", 0) > 80:
        flags.append("High velocity variability — inconsistent motor control")

    if image_features.get("ink_density", 1) < 0.010:
        flags.append("Near-empty drawing — test may have been skipped or is incomplete")

    return flags[:3]  # top 3


def derive_recommendation(score: float) -> str:
    """Map final risk score to a clinical recommendation string."""
    if score < 25:
        return (
            "Cognitive performance within normal range. "
            "No immediate action required. Recommend routine annual screening."
        )
    elif score < 45:
        return (
            "Mild subjective cognitive concerns detected. "
            "Recommend cognitive health counseling and lifestyle review. "
            "Repeat CDT in 6 months."
        )
    elif score < 65:
        return (
            "Mild Cognitive Impairment indicators present. "
            "Recommend referral to neuropsychology for comprehensive assessment. "
            "Avoid driving without further evaluation."
        )
    else:
        return (
            "High cognitive risk detected. "
            "Urgent referral to a neurologist is recommended. "
            "Consider neuroimaging evaluation (MRI/CT) and formal neuropsychological testing."
        )
