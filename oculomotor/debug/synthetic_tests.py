"""
================================================================================
 Synthetic tests — verify the biomarker math WITHOUT a camera.

 Run:  python -m oculomotor.debug.synthetic_tests
================================================================================
"""

import math
from ..data.data_containers import GazePoint
from ..analysis.biomarker_engine import BiomarkerEngine


def _gp(t, x, y=0.0, phase="stimulus", side="none"):
    return GazePoint(t, 0, phase, side, x, y, 0.5, 0.5, True)


def test_angular_velocity_known_case():
    """A 0.3 norm jump in 0.1 s at FOV 60° is 0.3*30/0.1 = 90 °/s."""
    a = _gp(0.0, 0.0)
    b = _gp(0.1, 0.3)
    v = BiomarkerEngine.angular_velocity(a, b)
    expected = 90.0
    ok = abs(v - expected) < 1.0
    print(f"[{'OK ' if ok else 'FAIL'}] angular_velocity: got {v:.2f}, "
          f"expected ~{expected}")
    return ok


def test_detect_saccades_single_fast():
    """One clean 90 °/s step must be detected once, direction 'right'."""
    pts = [_gp(t * 0.033, 0.0) for t in range(5)]          # 5 frames still
    pts += [_gp(0.166 + i * 0.033, 0.0 + 0.30 * (i + 1) / 3)
            for i in range(3)]                              # 3 frames moving
    pts += [_gp(0.266 + i * 0.033, 0.30) for i in range(5)] # 5 frames still
    events = BiomarkerEngine.detect_saccades(pts)
    ok = len(events) == 1 and events[0][2] == "right"
    print(f"[{'OK ' if ok else 'FAIL'}] detect_saccades (fast): "
          f"{len(events)} events, dirs={[e[2] for e in events]}")
    return ok


def test_detect_saccades_slow():
    """
    A slow ramp that crosses 0.30 norm over ~0.3 s (~30 °/s effective).
    Frame-to-frame velocity is ~27 °/s → current detector misses it.
    Window-based detector must still catch it.
    """
    pts = []
    for i in range(20):
        t = i * 0.033
        # ramp from 0 to 0.30 over first 0.3 s, then hold
        if t < 0.30:
            x = 0.30 * (t / 0.30)
        else:
            x = 0.30
        pts.append(_gp(t, x))
    events = BiomarkerEngine.detect_saccades(pts)
    ok = len(events) >= 1
    print(f"[{'OK ' if ok else 'FAIL'}] detect_saccades (slow 30°/s): "
          f"{len(events)} events")
    return ok


def test_detect_saccades_no_false_positive():
    """Static noise around centre must produce zero saccades."""
    import random
    random.seed(0)
    pts = [_gp(i * 0.033, random.uniform(-0.02, 0.02))
           for i in range(60)]
    events = BiomarkerEngine.detect_saccades(pts)
    ok = len(events) == 0
    print(f"[{'OK ' if ok else 'FAIL'}] detect_saccades (noise): "
          f"{len(events)} false positives")
    return ok


def test_classify_error_vs_correct():
    """
    stimulus right → correct = look left.
    Case A: subject looks right (error).
    Case B: subject looks left (correct).
    """
    stim_side = "right"
    # error: gaze swings to +0.4 within 200 ms
    err_pts = [_gp(i * 0.033, 0.0) for i in range(6)]
    err_pts += [_gp(0.198 + i * 0.033, 0.4 * (i + 1) / 3)
                for i in range(3)]
    err_pts += [_gp(0.297 + i * 0.033, 0.4) for i in range(6)]

    # correct: gaze swings to -0.4
    cor_pts = [_gp(i * 0.033, 0.0) for i in range(6)]
    cor_pts += [_gp(0.198 + i * 0.033, -0.4 * (i + 1) / 3)
                for i in range(3)]
    cor_pts += [_gp(0.297 + i * 0.033, -0.4) for i in range(6)]

    is_err_e, _, _, dir_e, lab_e = BiomarkerEngine.classify_trial(
        0.0, stim_side, err_pts)
    is_err_c, _, _, dir_c, lab_c = BiomarkerEngine.classify_trial(
        0.0, stim_side, cor_pts)

    ok = (lab_e == "error" and lab_c == "correct"
          and dir_e == "right" and dir_c == "left")
    print(f"[{'OK ' if ok else 'FAIL'}] classify_trial: "
          f"error→{lab_e}/{dir_e}, correct→{lab_c}/{dir_c}")
    return ok


def main():
    print("=" * 60)
    print(" Synthetic biomarker tests")
    print("=" * 60)
    results = [
        test_angular_velocity_known_case(),
        test_detect_saccades_single_fast(),
        test_detect_saccades_slow(),
        test_detect_saccades_no_false_positive(),
        test_classify_error_vs_correct(),
    ]
    n_ok = sum(results)
    print("=" * 60)
    print(f" {n_ok}/{len(results)} passed")
    print("=" * 60)


if __name__ == "__main__":
    main()