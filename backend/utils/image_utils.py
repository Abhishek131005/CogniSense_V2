"""
backend/utils/image_utils.py

Helpers for converting between base64 strings, PIL Images, and numpy arrays.
"""

import base64
import re
import numpy as np
from PIL import Image
import io


def base64_to_pil(b64_string: str) -> Image.Image:
    """
    Convert a base64 data URL (or raw base64) to a PIL Image.
    Handles both:
      - "data:image/png;base64,iVBOR..."
      - "iVBOR..."
    """
    # Strip the data URL prefix if present
    if b64_string.startswith("data:"):
        b64_string = re.sub(r"^data:image/[a-zA-Z]+;base64,", "", b64_string)

    img_bytes = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(img_bytes))

    # If the image has an alpha channel (like PNGs from HTML5 canvas),
    # the transparent background needs to be converted to white, otherwise
    # PIL's convert("RGB") will turn it pitch black, ruining OpenCV thresholds!
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        alpha = img.convert('RGBA').split()[-1]
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=alpha)
        return bg
    else:
        return img.convert("RGB")


def pil_to_numpy(img: Image.Image) -> np.ndarray:
    """Convert PIL Image to numpy array (H, W, C) uint8."""
    return np.array(img)


def pil_to_grayscale_numpy(img: Image.Image) -> np.ndarray:
    """Convert PIL Image to grayscale numpy array (H, W) uint8."""
    return np.array(img.convert("L"))
