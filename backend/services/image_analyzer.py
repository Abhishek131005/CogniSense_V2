"""
backend/services/image_analyzer.py

OpenCV-based visual feature extraction from a CDT clock drawing image.

Extracts clinically-meaningful geometric features:
  - quadrant_coverage   : How many of 4 quadrants have drawn content
  - estimated_numbers   : Approximate count of disconnected drawn regions (proxy for numerals)
  - hand_count          : Number of long line segments detected (clock hands)
  - center_usage        : Whether strokes pass through the clock center
  - ink_density         : Ratio of drawn pixels vs canvas area
  - stroke_spread       : Spread of drawn content across the canvas
"""

import cv2
import numpy as np
from PIL import Image
from utils.image_utils import pil_to_grayscale_numpy, pil_to_numpy


def extract_image_features(img: Image.Image) -> dict:
    """
    Run full OpenCV analysis pipeline on a CDT drawing.
    Returns a dict of float feature values (all normalized 0-1 where applicable).
    """
    gray = pil_to_grayscale_numpy(img)
    rgb  = pil_to_numpy(img)

    h, w = gray.shape

    # ── 1. Threshold: isolate drawn ink (dark pixels on white canvas) ──────────
    # Invert: drawn strokes become white (255), background black (0)
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)

    # Since this is a digital canvas, there is no "dust" or sensor noise.
    # We do NOT run cv2.morphologyEx(MORPH_OPEN) here because a 3x3 kernel 
    # will completely erase the 2.2px thin digital pen strokes!

    # ── 2. Ink density ─────────────────────────────────────────────────────────
    ink_pixels = np.count_nonzero(binary)
    total_pixels = h * w
    ink_density = ink_pixels / total_pixels

    # ── 3. Quadrant coverage ───────────────────────────────────────────────────
    cx, cy = w // 2, h // 2
    quadrants = [
        binary[:cy, :cx],   # top-left
        binary[:cy, cx:],   # top-right
        binary[cy:, :cx],   # bottom-left
        binary[cy:, cx:],   # bottom-right
    ]
    quadrant_coverage = sum(1 for q in quadrants if np.count_nonzero(q) > 50) / 4.0

    # ── 4. Connected component analysis (proxy for numeral count) ──────────────
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        binary, connectivity=8
    )
    # Filter: keep only mid-size blobs (not tiny noise, not the full circle)
    min_area = 50
    max_area = total_pixels * 0.3
    valid_components = [
        i for i in range(1, num_labels)
        if min_area < stats[i, cv2.CC_STAT_AREA] < max_area
    ]
    estimated_numbers = min(len(valid_components) / 12.0, 1.0)  # normalize to 12

    # ── 5. Line (clock hand) detection via HoughLinesP ─────────────────────────
    edges = cv2.Canny(binary, 30, 100)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=25,                              # lower = more sensitive to faint strokes
        minLineLength=int(min(h, w) * 0.08),       # 8% of canvas (was 15%) — catches short hands
        maxLineGap=15
    )

    hand_count = 0
    hand_angles = []
    if lines is not None:
        # Use POINT-TO-LINE-SEGMENT distance instead of midpoint distance.
        # This correctly detects lines that PASS THROUGH the center zone
        # regardless of where their midpoint is.
        center_proximity = int(min(h, w) * 0.30)  # 30% tolerance (was 20%)
        for line in lines:
            x1, y1, x2, y2 = line[0]
            # Vector math: shortest distance from center (cx,cy) to segment (x1,y1)-(x2,y2)
            dx, dy = x2 - x1, y2 - y1
            seg_len_sq = dx * dx + dy * dy
            if seg_len_sq == 0:
                dist = np.hypot(x1 - cx, y1 - cy)
            else:
                t = max(0, min(1, ((cx - x1) * dx + (cy - y1) * dy) / seg_len_sq))
                proj_x = x1 + t * dx
                proj_y = y1 + t * dy
                dist = np.hypot(proj_x - cx, proj_y - cy)
            
            if dist < center_proximity:
                # Calculate the angle of the hand.
                d1 = np.hypot(x1 - cx, y1 - cy)
                d2 = np.hypot(x2 - cx, y2 - cy)
                tip_x, tip_y = (x1, y1) if d1 > d2 else (x2, y2)
                
                angle = np.degrees(np.arctan2(tip_y - cy, tip_x - cx))
                hand_angles.append(angle)

    # Cluster overlapping/collinear lines into unique hands
    # (HoughLinesP often returns 4-5 overlapping segments for a single thick hand)
    unique_angles = []
    for a in hand_angles:
        # Check if we already have a hand pointing in roughly this direction (within 15 degrees)
        is_duplicate = False
        for i, ua in enumerate(unique_angles):
            # Shortest distance between angles
            diff = abs((a - ua + 180) % 360 - 180)
            if diff < 15:
                # Average them out for better precision
                unique_angles[i] = (ua + a) / 2.0
                is_duplicate = True
                break
        
        if not is_duplicate:
            unique_angles.append(a)

    hand_count = len(unique_angles)
    # Clamp: more than 2 detected lines still = 1.0 (full score)
    hand_count_norm = min(hand_count / 2.0, 1.0)
    
    # ... rest ...

    # ── 6. Center usage ────────────────────────────────────────────────────────
    # Check if any drawn content passes through a central 10% radius region
    center_radius = int(min(h, w) * 0.10)
    center_mask = np.zeros_like(binary)
    cv2.circle(center_mask, (cx, cy), center_radius, 255, -1)
    center_overlap = np.count_nonzero(cv2.bitwise_and(binary, center_mask))
    center_usage = min(center_overlap / (np.pi * center_radius**2), 1.0)

    # ── 7. Stroke spread (bounding box vs canvas area) ─────────────────────────
    points = cv2.findNonZero(binary)
    stroke_spread = 0.0
    if points is not None:
        x_min, y_min, bw, bh = cv2.boundingRect(points)
        bbox_area = bw * bh
        stroke_spread = min(bbox_area / total_pixels, 1.0)

    return {
        "ink_density":          round(ink_density, 4),
        "quadrant_coverage":    round(quadrant_coverage, 4),
        "estimated_numbers":    round(estimated_numbers, 4),
        "hand_count_norm":      round(hand_count_norm, 4),
        "center_usage":         round(center_usage, 4),
        "stroke_spread":        round(stroke_spread, 4),
        "raw_hand_count":       int(hand_count),
        "raw_component_count":  int(len(valid_components)),
        "hand_angles":          unique_angles,
    }
