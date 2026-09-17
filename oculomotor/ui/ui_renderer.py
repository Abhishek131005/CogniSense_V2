"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 UIRenderer — OpenCV drawing helpers
   • Head-lock box is drawn on the CAMERA PREVIEW inset (top-right)
   • Task canvas stays clean (stimuli + text only)
================================================================================
"""

import cv2
import numpy as np

from ..config import (
    COL_BG, COL_CROSS, COL_STIMULUS, COL_PURSUIT_DOT, COL_TEXT,
    COL_GOOD, COL_WARN, COL_BAD, COL_GAZE, COL_TARGET,
    COL_HEADBOX, COL_HEADBOX_OK, COL_HEADBOX_BAD,
    HEAD_BOX_W_FRAC, HEAD_BOX_H_FRAC,
)

FONT = cv2.FONT_HERSHEY_SIMPLEX


class UIRenderer:
    """Stateless collection of OpenCV drawing helpers."""

    # ── canvas helpers ────────────────────────────────────────────────────
    @staticmethod
    def blank(w: int, h: int) -> np.ndarray:
        return np.full((h, w, 3), COL_BG, dtype=np.uint8)

    @staticmethod
    def fixation_cross(canvas, cx, cy, size=30, thickness=3):
        cv2.line(canvas, (cx - size, cy), (cx + size, cy), COL_CROSS, thickness)
        cv2.line(canvas, (cx, cy - size), (cx, cy + size), COL_CROSS, thickness)

    @staticmethod
    def stimulus_dot(canvas, x, y, radius=20):
        cv2.circle(canvas, (x, y), radius, COL_STIMULUS, -1)

    @staticmethod
    def pursuit_dot(canvas, x, y, radius=18):
        cv2.circle(canvas, (x, y), radius, COL_PURSUIT_DOT, -1)

    @staticmethod
    def status_bar(canvas, text, colour=COL_TEXT, y_frac=0.05):
        h, w = canvas.shape[:2]
        y = int(h * y_frac)
        cv2.putText(canvas, text, (20, y), FONT, 0.65, colour, 2, cv2.LINE_AA)

    @staticmethod
    def centered_text(canvas, text, y, scale=0.65, colour=COL_TEXT,
                      thickness=2):
        """Draw horizontally-centred text at height y."""
        h, w = canvas.shape[:2]
        (tw, th), _ = cv2.getTextSize(text, FONT, scale, thickness)
        x = (w - tw) // 2
        cv2.putText(canvas, text, (x, y), FONT, scale, colour, thickness,
                    cv2.LINE_AA)
        return tw, th

    @staticmethod
    def progress_bar(canvas, current, total):
        h, w = canvas.shape[:2]
        bar_w = int(w * 0.5)
        bar_h = 8
        bx = (w - bar_w) // 2
        by = h - 30
        cv2.rectangle(canvas, (bx, by), (bx + bar_w, by + bar_h),
                      (60, 60, 60), -1)
        filled = int(bar_w * current / max(total, 1))
        cv2.rectangle(canvas, (bx, by), (bx + filled, by + bar_h),
                      COL_GOOD, -1)
        label = f"Trial {current}/{total}"
        cv2.putText(canvas, label, (bx + bar_w + 10, by + bar_h),
                    FONT, 0.5, COL_TEXT, 1, cv2.LINE_AA)

    # ── gaze dot on the TASK canvas ───────────────────────────────────────
    @staticmethod
    def gaze_dot(canvas, nx: float, ny: float, radius: int = 8,
                 colour: tuple = COL_GAZE):
        """
        Small dot on the task canvas showing where the eye is pointing.
        Only draw if nx/ny are valid.
        """
        if np.isnan(nx) or np.isnan(ny):
            return
        h, w = canvas.shape[:2]
        px = int((nx * 0.4 + 0.5) * w)
        py = int((ny * 0.4 + 0.5) * h)
        px = max(radius, min(w - radius, px))
        py = max(radius, min(h - radius, py))
        cv2.circle(canvas, (px, py), radius + 3, (0, 0, 0), -1)
        cv2.circle(canvas, (px, py), radius, colour, -1)

    # ── camera preview WITH head-lock box ─────────────────────────────────
    @staticmethod
    def camera_preview_with_headlock(
        canvas: np.ndarray,
        frame_bgr: np.ndarray,
        head_x: float,
        head_y: float,
        inside: bool,
        face_detected: bool | None,
        *,
        preview_w_frac: float = 0.30,
        margin: int = 18,
    ):
        """
        Draw the camera preview inset in the top-right corner, then
        overlay the head-lock box and the head-position marker
        directly ON TOP of the camera image.

        This is the only place the subject watches to keep their head
        centered — the task canvas itself stays clean.
        """
        h, w = canvas.shape[:2]
        ph = max(140, int(h * 0.26))
        pw = max(200, int(w * preview_w_frac))

        # ── resize camera frame to inset size ────────────────────────────
        preview = cv2.resize(frame_bgr, (pw, ph), interpolation=cv2.INTER_AREA)

        # ── compute where the box lives INSIDE the preview ───────────────
        bw = int(pw * HEAD_BOX_W_FRAC)
        bh = int(ph * HEAD_BOX_H_FRAC)
        bx1 = (pw - bw) // 2
        by1 = (ph - bh) // 2
        bx2 = bx1 + bw
        by2 = by1 + bh

        col = COL_HEADBOX_OK if inside else COL_HEADBOX_BAD

        # ── draw box on the preview copy ─────────────────────────────────
        overlay = preview.copy()
        cv2.rectangle(overlay, (bx1, by1), (bx2, by2), col, -1)
        cv2.addWeighted(overlay, 0.08, preview, 0.92, 0, preview)
        cv2.rectangle(preview, (bx1, by1), (bx2, by2), col, 2)

        # corner ticks
        tick = max(10, int(min(pw, ph) * 0.06))
        for (cx, cy, dx, dy) in [(bx1, by1, 1, 1), (bx2, by1, -1, 1),
                                 (bx1, by2, 1, -1), (bx2, by2, -1, -1)]:
            cv2.line(preview, (cx, cy), (cx + dx * tick, cy), col, 3)
            cv2.line(preview, (cx, cy), (cx, cy + dy * tick), col, 3)

        # ── draw head-position marker ────────────────────────────────────
        if face_detected and not np.isnan(head_x) and not np.isnan(head_y):
            px = int(head_x * pw)
            py = int(head_y * ph)
            px = max(0, min(pw - 1, px))
            py = max(0, min(ph - 1, py))
            cv2.circle(preview, (px, py), 7, col, -1)
            cv2.circle(preview, (px, py), 7, (255, 255, 255), 2)

        # ── paste preview into the canvas ────────────────────────────────
        x1 = max(0, w - pw - margin)
        y1 = margin
        x2 = min(w, x1 + pw)
        y2 = min(h, y1 + ph)
        canvas[y1:y2, x1:x2] = preview[: (y2 - y1), : (x2 - x1)]
        cv2.rectangle(canvas, (x1 - 2, y1 - 2), (x2 + 2, y2 + 2),
                      (220, 220, 220), 1)

        # ── status caption under preview ────────────────────────────────
        if face_detected is None:
            status, scolor = "Face: checking…", (180, 180, 180)
        elif not face_detected:
            status, scolor = "Face: NOT detected", COL_STIMULUS
        elif inside:
            status, scolor = "Head: INSIDE box ✓", COL_GOOD
        else:
            status, scolor = "Head: MOVE INSIDE box", COL_HEADBOX_BAD

        label_y = min(h - 8, y2 + 22)
        cv2.putText(canvas, status, (x1, label_y),
                    FONT, 0.58, scolor, 2, cv2.LINE_AA)

    # ── big outcome banner (correct / error) ─────────────────────────────
    @staticmethod
    def outcome_badge(canvas, text: str, colour: tuple):
        h, w = canvas.shape[:2]
        (tw, th), _ = cv2.getTextSize(text, FONT, 1.0, 2)
        x = (w - tw) // 2
        y = int(h * 0.12)
        pad = 14
        overlay = canvas.copy()
        cv2.rectangle(overlay, (x - pad, y - th - pad),
                      (x + tw + pad, y + pad), colour, -1)
        cv2.addWeighted(overlay, 0.85, canvas, 0.15, 0, canvas)
        cv2.putText(canvas, text, (x, y), FONT, 1.0, (255, 255, 255), 2,
                    cv2.LINE_AA)

    # ── gaze-vs-target bar (bottom of the task canvas) ───────────────────
    @staticmethod
    def gaze_vs_target_bar(canvas, norm_x: float, target_x: float,
                           label: str, col: tuple = COL_TEXT):
        """
        Horizontal bar showing where MediaPipe thinks the subject is
        looking (●) vs. where the correct target is (▮).
        norm_x / target_x ∈ [-1, 1].
        """
        h, w = canvas.shape[:2]
        bar_w = int(w * 0.7)
        bar_x = (w - bar_w) // 2
        bar_y = h - 90
        bar_h = 22
        cv2.rectangle(canvas, (bar_x, bar_y),
                      (bar_x + bar_w, bar_y + bar_h), (40, 40, 40), -1)
        cv2.rectangle(canvas, (bar_x, bar_y),
                      (bar_x + bar_w, bar_y + bar_h), (100, 100, 100), 1)

        cx = bar_x + bar_w // 2
        cv2.line(canvas, (cx, bar_y - 4), (cx, bar_y + bar_h + 4),
                 (150, 150, 150), 1)

        def _px(v):
            v = max(-1.0, min(1.0, v))
            return int(bar_x + (v * 0.5 + 0.5) * bar_w)

        if not np.isnan(target_x):
            tx = _px(target_x)
            cv2.rectangle(canvas, (tx - 3, bar_y - 6),
                          (tx + 3, bar_y + bar_h + 6), COL_TARGET, -1)
        if not np.isnan(norm_x):
            gx = _px(norm_x)
            cv2.circle(canvas, (gx, bar_y + bar_h // 2), 8, COL_GAZE, -1)
            cv2.circle(canvas, (gx, bar_y + bar_h // 2), 8, (0, 0, 0), 1)

        cv2.putText(canvas, label, (bar_x, bar_y - 12),
                    FONT, 0.55, col, 1, cv2.LINE_AA)

    # ── numeric debug overlay ─────────────────────────────────────────────
    @staticmethod
    def debug_overlay(canvas, nx, ny, first_dir, response_label):
        """Small numeric overlay for debugging — enable only when needed."""
        h, w = canvas.shape[:2]
        cv2.putText(canvas,
                    f"nx={nx:+.3f}  ny={ny:+.3f}  "
                    f"first={first_dir}  resp={response_label}",
                    (20, h - 140), FONT, 0.6, (200, 200, 200), 1, cv2.LINE_AA)

        # ── MediaPipe landmark overlay (iris + corners + nose) ────────────────
    @staticmethod
    def mp_landmarks(canvas: np.ndarray, landmarks: list):
        """
        Draw MediaPipe iris ring, eye corners, and nose tip on the canvas.
        Same colours as the debug iris visualiser so behaviour is
        consistent between debug and live-trial views:

            left iris    → yellow
            right iris   → cyan
            left  corners→ green (inner) / dark green (outer)
            right corners→ red   (inner) / dark red   (outer)
            nose tip     → magenta
        """
        if landmarks is None:
            return
        h, w = canvas.shape[:2]

        from ..config import (
            L_INNER_CORNER, L_OUTER_CORNER, R_INNER_CORNER, R_OUTER_CORNER,
            LIRS_INDICES_FULL, RIRS_INDICES_FULL,
        )

        # iris rings
        for idx in LIRS_INDICES_FULL:
            p = landmarks[idx]
            cv2.circle(canvas, (int(p.x * w), int(p.y * h)),
                       3, (255, 255, 0), -1)
        for idx in RIRS_INDICES_FULL:
            p = landmarks[idx]
            cv2.circle(canvas, (int(p.x * w), int(p.y * h)),
                       3, (0, 255, 255), -1)

        # eye corners
        for idx, col in [(L_INNER_CORNER, (0, 255, 0)),
                         (L_OUTER_CORNER, (0, 200, 0)),
                         (R_INNER_CORNER, (0, 0, 255)),
                         (R_OUTER_CORNER, (0, 0, 200))]:
            p = landmarks[idx]
            cv2.circle(canvas, (int(p.x * w), int(p.y * h)),
                       5, col, -1)

        # nose tip
        p = landmarks[1]
        cv2.circle(canvas, (int(p.x * w), int(p.y * h)),
                   4, (255, 0, 255), -1)