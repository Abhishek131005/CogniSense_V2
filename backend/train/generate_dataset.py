"""
backend/train/generate_dataset.py

Generates a synthetic clock drawing dataset for training the CDT CNN.

Each sample = a PIL Image of a clock drawing + a label:
  0 = Normal (well-structured clock)
  1 = Impaired (missing numbers / hands / distorted)

Generates:
  - train/data/class_0_normal/     ← 600 images
  - train/data/class_1_impaired/   ← 600 images

Usage:
  cd backend
  python train/generate_dataset.py
"""

import os
import random
import math
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
N_PER_CLASS = 600
IMG_SIZE    = 400

# ── Helpers ───────────────────────────────────────────────────────────────────


def blank_canvas(size=IMG_SIZE) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img  = Image.new("RGB", (size, size), color=(250, 248, 244))
    draw = ImageDraw.Draw(img)
    return img, draw


def draw_clock_circle(draw: ImageDraw.ImageDraw, cx, cy, r, perturbation=0):
    """Draw the pre-printed clock outline circle (always present)."""
    jitter = perturbation
    draw.ellipse(
        [cx - r + random.uniform(-jitter, jitter),
         cy - r + random.uniform(-jitter, jitter),
         cx + r + random.uniform(-jitter, jitter),
         cy + r + random.uniform(-jitter, jitter)],
        outline=(180, 175, 165),
        width=2,
    )


def draw_numerals(draw: ImageDraw.ImageDraw, cx, cy, r, present_count=12, jitter=5):
    """Draw clock numerals at correct positions."""
    for i in range(1, 13):
        if i > present_count:
            continue
        angle = math.radians((i / 12) * 360 - 90)
        nr    = r * 0.78
        x     = cx + nr * math.cos(angle) + random.uniform(-jitter, jitter)
        y     = cy + nr * math.sin(angle) + random.uniform(-jitter, jitter)
        draw.text((x - 5, y - 6), str(i), fill=(28, 28, 24))


def draw_hands(draw: ImageDraw.ImageDraw, cx, cy, r, hour=11, minute=10, draw_both=True):
    """Draw clock hands pointing to a given time."""
    # Minute hand (10 → 60°)
    min_angle  = math.radians((minute / 60) * 360 - 90)
    hour_angle = math.radians(((hour + minute / 60) / 12) * 360 - 90)

    min_r  = r * 0.72
    hour_r = r * 0.50

    if draw_both:
        # Minute hand
        draw.line(
            [cx, cy,
             cx + min_r * math.cos(min_angle),
             cy + min_r * math.sin(min_angle)],
            fill=(28, 28, 24), width=3,
        )
    # Hour hand
    draw.line(
        [cx, cy,
         cx + hour_r * math.cos(hour_angle),
         cy + hour_r * math.sin(hour_angle)],
        fill=(28, 28, 24), width=4,
    )


def add_noise_strokes(draw: ImageDraw.ImageDraw, cx, cy, r, count=3):
    """Add extra random scribble strokes (simulates impaired drawing)."""
    for _ in range(count):
        x1 = random.uniform(cx - r, cx + r)
        y1 = random.uniform(cy - r, cy + r)
        x2 = x1 + random.uniform(-60, 60)
        y2 = y1 + random.uniform(-60, 60)
        draw.line([x1, y1, x2, y2], fill=(28, 28, 24), width=random.randint(1, 3))


# ── Generator functions ───────────────────────────────────────────────────────


def generate_normal_clock() -> Image.Image:
    """
    Produce a well-structured clock:
    - All 12 numerals present (slight jitter)
    - Both hands drawn correctly (time 10:10)
    - Minimal extra strokes
    """
    img, draw = blank_canvas()
    cx, cy  = IMG_SIZE // 2, IMG_SIZE // 2
    r       = int(IMG_SIZE * 0.42)

    draw_clock_circle(draw, cx, cy, r, perturbation=2)
    draw_numerals(draw, cx, cy, r, present_count=12, jitter=random.uniform(2, 8))
    draw_hands(draw, cx, cy, r, hour=10, minute=10, draw_both=True)

    # Occasional minor random strokes (doesn't affect score)
    if random.random() < 0.2:
        add_noise_strokes(draw, cx, cy, r, count=1)

    return img


def generate_impaired_clock() -> Image.Image:
    """
    Produce an impaired / incomplete clock with randomized deficits:
    - Missing numerals (0–8 present)
    - Missing or misplaced hands
    - Extra random scribble strokes
    - Numerals placed in wrong quadrants
    """
    img, draw = blank_canvas()
    cx, cy  = IMG_SIZE // 2, IMG_SIZE // 2
    r       = int(IMG_SIZE * 0.42)

    # Draw the pre-printed circle (always present — clinic provides this)
    draw_clock_circle(draw, cx, cy, r, perturbation=5)

    impairment_type = random.choice([
        "missing_numbers",
        "missing_hands",
        "scribble_only",
        "crowded_numbers",
        "empty",
        "wrong_time",
    ])

    if impairment_type == "missing_numbers":
        n = random.randint(0, 7)
        draw_numerals(draw, cx, cy, r, present_count=n, jitter=random.uniform(5, 25))
        draw_hands(draw, cx, cy, r, hour=10, minute=10, draw_both=random.choice([True, False]))

    elif impairment_type == "missing_hands":
        draw_numerals(draw, cx, cy, r, present_count=12, jitter=random.uniform(3, 15))
        # Draw only one hand or none
        if random.random() < 0.5:
            draw_hands(draw, cx, cy, r, hour=10, minute=10, draw_both=False)

    elif impairment_type == "scribble_only":
        add_noise_strokes(draw, cx, cy, r, count=random.randint(5, 12))

    elif impairment_type == "crowded_numbers":
        # All numbers clustered in one half
        for i in range(1, 13):
            angle = math.radians(random.uniform(-30, 30) + (i * 5))  # bunched
            nr    = r * 0.78
            x     = cx + nr * math.cos(angle)
            y     = cy + nr * math.sin(angle)
            draw.text((x, y), str(i), fill=(28, 28, 24))

    elif impairment_type == "empty":
        # Just the circle — no numerals, no hands
        add_noise_strokes(draw, cx, cy, r, count=random.randint(1, 3))

    elif impairment_type == "wrong_time":
        draw_numerals(draw, cx, cy, r, present_count=12, jitter=5)
        # Draw hands pointing to wrong time
        draw_hands(draw, cx, cy, r,
                   hour=random.randint(1, 12),
                   minute=random.randint(0, 59),
                   draw_both=True)
        add_noise_strokes(draw, cx, cy, r, count=random.randint(2, 5))

    return img


# ── Main ──────────────────────────────────────────────────────────────────────


def main():
    normal_dir   = os.path.join(OUTPUT_DIR, "class_0_normal")
    impaired_dir = os.path.join(OUTPUT_DIR, "class_1_impaired")
    os.makedirs(normal_dir,   exist_ok=True)
    os.makedirs(impaired_dir, exist_ok=True)

    print(f"Generating {N_PER_CLASS} normal clocks...")
    for i in range(N_PER_CLASS):
        img = generate_normal_clock()
        img.save(os.path.join(normal_dir, f"normal_{i:04d}.png"))
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{N_PER_CLASS}")

    print(f"\nGenerating {N_PER_CLASS} impaired clocks...")
    for i in range(N_PER_CLASS):
        img = generate_impaired_clock()
        img.save(os.path.join(impaired_dir, f"impaired_{i:04d}.png"))
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{N_PER_CLASS}")

    print(f"\nDataset ready:")
    print(f"  Normal:   {N_PER_CLASS} images -> {normal_dir}")
    print(f"  Impaired: {N_PER_CLASS} images -> {impaired_dir}")
    print(f"\nNext step: python train/train_cnn.py")


if __name__ == "__main__":
    main()
