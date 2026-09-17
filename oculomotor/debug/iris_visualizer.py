"""
================================================================================
 Live iris / landmark visualiser.

 Run:  python -m oculomotor.debug.iris_visualizer

 What you see:
   • The camera image with every iris landmark (468–477) marked.
   • Eye corners (33, 133, 362, 263) marked in colour.
   • A live horizontal gauge showing norm_x, with ±0.15 tick marks.
   • A small "eye crop" for each eye so you can see the iris pixel
     that MediaPipe is choosing.

 What to check:
   • Iris dots should sit ON the pupil, not the eyelid.
   • When you look hard left, the gauge should peg near -0.4 … -0.5.
   • When you look hard right, it should peg near +0.4 … +0.5.
   • When you stare at the camera, it should sit near 0.0 ± 0.05.
   • If the gauge moves the WRONG way, the sign convention in
     FaceMeshTracker.extract_gaze is inverted.
   • If the gauge barely moves, MediaPipe is not picking up the iris.
================================================================================
"""

import cv2
import numpy as np
import time

from ..tracking.face_mesh_tracker import FaceMeshTracker
from ..config import (
    L_INNER_CORNER, L_OUTER_CORNER, R_INNER_CORNER, R_OUTER_CORNER,
    LIRS_INDICES_FULL, RIRS_INDICES_FULL,
)

FONT = cv2.FONT_HERSHEY_SIMPLEX


def _draw_landmarks(img, lm, w, h):
    for idx in LIRS_INDICES_FULL:
        p = lm[idx]
        cv2.circle(img, (int(p.x * w), int(p.y * h)), 3, (255, 255, 0), -1)
    for idx in RIRS_INDICES_FULL:
        p = lm[idx]
        cv2.circle(img, (int(p.x * w), int(p.y * h)), 3, (0, 255, 255), -1)
    for idx, col in [(L_INNER_CORNER, (0, 255, 0)),
                     (L_OUTER_CORNER, (0, 200, 0)),
                     (R_INNER_CORNER, (0, 0, 255)),
                     (R_OUTER_CORNER, (0, 0, 200))]:
        p = lm[idx]
        cv2.circle(img, (int(p.x * w), int(p.y * h)), 5, col, -1)
    p = lm[1]
    cv2.circle(img, (int(p.x * w), int(p.y * h)), 4, (255, 0, 255), -1)


def _gauge(canvas, nx, ny):
    h, w = canvas.shape[:2]
    bar_w = int(w * 0.7); bar_x = (w - bar_w) // 2
    bar_y = h - 110;       bar_h = 34
    cv2.rectangle(canvas, (bar_x, bar_y),
                  (bar_x + bar_w, bar_y + bar_h), (50, 50, 50), -1)
    cx = bar_x + bar_w // 2
    cv2.line(canvas, (cx, bar_y), (cx, bar_y + bar_h), (220, 220, 220), 2)
    for thr in (-0.5, -0.25, -0.15, 0.15, 0.25, 0.5):
        tx = int(bar_x + (thr * 0.5 + 0.5) * bar_w)
        col = (140, 140, 140) if abs(thr) < 0.2 else (90, 90, 90)
        cv2.line(canvas, (tx, bar_y - 6), (tx, bar_y + bar_h + 6), col, 1)
    if not np.isnan(nx):
        gx = int(bar_x + (max(-1, min(1, nx)) * 0.5 + 0.5) * bar_w)
        cv2.circle(canvas, (gx, bar_y + bar_h // 2), 12, (255, 255, 0), -1)
        cv2.circle(canvas, (gx, bar_y + bar_h // 2), 12, (0, 0, 0), 2)
    txt = f"norm_x = {nx:+.3f}   norm_y = {ny:+.3f}"
    cv2.putText(canvas, txt, (bar_x, bar_y - 18),
                FONT, 0.75, (255, 255, 255), 2)


def run():
    tracker = FaceMeshTracker()
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    print("[INFO] Iris visualiser running — press Q to quit.")
    print("[INFO] Watch the gauge. Look hard left / hard right.")

    with tracker:
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]
            canvas = frame.copy()

            lm = tracker.process_frame(frame)
            if lm is None:
                cv2.putText(canvas, "NO FACE DETECTED",
                            (40, 60), FONT, 1.0, (60, 60, 230), 3)
                cv2.imshow("Iris Visualiser", canvas)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                continue

            _draw_landmarks(canvas, lm, w, h)

            nx, ny, rlx, rly = FaceMeshTracker.extract_gaze(lm, w, h)
            _gauge(canvas, nx, ny)

            # eye crops (left & right)
            def _crop(centre_idx, size=60):
                p = lm[centre_idx]
                cx, cy = int(p.x * w), int(p.y * h)
                x1 = max(0, cx - size); y1 = max(0, cy - size)
                x2 = min(w, cx + size); y2 = min(h, cy + size)
                return frame[y1:y2, x1:x2], (x1, y1)

            l_crop, _ = _crop(L_IRIS_CENTER if False else LIRS_INDICES_FULL[0])
            r_crop, _ = _crop(RIRS_INDICES_FULL[0])
            if l_crop.size and r_crop.size:
                l_big = cv2.resize(l_crop, (220, 220))
                r_big = cv2.resize(r_crop, (220, 220))
                canvas[10:230, 10:230]        = l_big
                canvas[10:230, w - 230:w - 10] = r_big
                cv2.putText(canvas, "L eye", (12, 250),
                            FONT, 0.55, (255, 255, 255), 1)
                cv2.putText(canvas, "R eye", (w - 220, 250),
                            FONT, 0.55, (255, 255, 255), 1)

            cv2.putText(canvas,
                        "Look hard LEFT, then hard RIGHT, then centre.",
                        (40, h - 160), FONT, 0.7, (200, 200, 200), 2)

            cv2.imshow("Iris Visualiser", canvas)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run()