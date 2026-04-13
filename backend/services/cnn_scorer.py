"""
backend/services/cnn_scorer.py

ResNet-18 CNN inference wrapper.

On startup:
  - Loads ResNet-18 pretrained on ImageNet from torchvision
  - Replaces the final FC layer with a 2-class head (normal=0, impaired=1)
  - Tries to load fine-tuned weights from models/cdt_cnn.pth
  - If weights are absent, runs in "embedding mode" — uses penultimate layer
    activations to estimate drawing complexity as a proxy visual score

Output: a single float in [0, 1] where:
  0.0 = very likely normal / cognitively healthy clock
  1.0 = very likely impaired clock
"""

import os
import logging
import numpy as np
from PIL import Image

import torch
import torch.nn as nn
import torchvision.transforms as T
from torchvision import models

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "cdt_cnn.pth")
IMG_SIZE   = 224   # ResNet input size
DEVICE     = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ImageNet normalization (required for pretrained ResNet)
_TRANSFORM = T.Compose([
    T.Resize((IMG_SIZE, IMG_SIZE)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def _build_model() -> nn.Module:
    """Build ResNet-18 with a 2-class output head."""
    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    # Replace final FC: 512 → 2 (binary classification)
    model.fc = nn.Linear(model.fc.in_features, 2)
    return model


class CDTScorer:
    """Singleton CNN scorer — loaded once at startup."""

    def __init__(self):
        self._model = _build_model().to(DEVICE)
        self._model.eval()
        self._has_fine_tuned_weights = False

        # Try to load fine-tuned weights
        model_path = os.path.abspath(MODEL_PATH)
        if os.path.exists(model_path):
            try:
                state = torch.load(model_path, map_location=DEVICE)
                self._model.load_state_dict(state)
                self._has_fine_tuned_weights = True
                logger.info(f"[CDTScorer] Loaded fine-tuned weights from {model_path}")
            except Exception as e:
                logger.warning(f"[CDTScorer] Could not load weights: {e}. Using ImageNet embeddings.")
        else:
            logger.info(
                f"[CDTScorer] No fine-tuned weights found at {model_path}. "
                "Running in ImageNet embedding mode. Run train/train_cnn.py to create weights."
            )

    @torch.no_grad()
    def score(self, img: Image.Image) -> float:
        """
        Returns a float in [0, 1]:
          ~0.0 = normal/healthy clock
          ~1.0 = impaired clock

        If fine-tuned: output is softmax probability of 'impaired' class.
        If base (ImageNet): output is based on visual complexity heuristic
          derived from the embedding activations.
        """
        tensor = _TRANSFORM(img.convert("RGB")).unsqueeze(0).to(DEVICE)

        if self._has_fine_tuned_weights:
            # Fine-tuned mode: direct classification
            logits = self._model(tensor)           # shape: [1, 2]
            probs  = torch.softmax(logits, dim=1)  # shape: [1, 2]
            impaired_prob = probs[0, 1].item()     # probability of class 1 = impaired
            return round(float(impaired_prob), 4)
        else:
            # Embedding mode: use penultimate layer (avgpool output)
            # High activation variance → complex/rich/normal drawing
            # Low activation variance → sparse/blank/impaired drawing
            features = self._get_embeddings(tensor)
            embedding_score = self._embedding_to_risk(features)
            return round(float(embedding_score), 4)

    def _get_embeddings(self, tensor: torch.Tensor) -> np.ndarray:
        """Extract 512-dim avgpool embeddings from ResNet."""
        # Forward through all layers except the final FC
        x = tensor
        for name, layer in self._model.named_children():
            if name == "fc":
                break
            x = layer(x)
        return x.squeeze().cpu().numpy()  # shape: (512,)

    def _embedding_to_risk(self, embeddings: np.ndarray) -> float:
        """
        Convert embedding vector to a proxy risk score using activation statistics.
        
        Rationale:
          - A blank / sparse canvas produces low, uniform activations
          - A rich, structured drawing (good clock) produces diverse, high activations
          - An impaired drawing has intermediate or chaotic activations
        
        We use: normalized inverse of activation variance (sparse → high risk)
        """
        mean_activation = float(np.mean(np.abs(embeddings)))
        std_activation  = float(np.std(embeddings))

        # Calibrated thresholds from empirical testing on synthetic images
        # Low mean + low std → blank canvas → high risk
        # High mean + high std → complex drawing → lower risk
        MEAN_SCALE = 0.5   # expected mean for a typical clock image
        STD_SCALE  = 0.3   # expected std

        # Normalize each metric (0 = blank, 1 = normal)
        mean_norm = min(mean_activation / MEAN_SCALE, 1.0)
        std_norm  = min(std_activation  / STD_SCALE,  1.0)

        # Weighted proxy: sparse drawings → higher risk
        visual_quality = (mean_norm * 0.4 + std_norm * 0.6)
        risk = 1.0 - visual_quality   # invert: high quality = low risk

        return max(0.0, min(1.0, risk))


# Module-level singleton — imported by score_fusion.py
_scorer_instance: CDTScorer | None = None


def get_cnn_scorer() -> CDTScorer:
    global _scorer_instance
    if _scorer_instance is None:
        _scorer_instance = CDTScorer()
    return _scorer_instance
