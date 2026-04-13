"""
backend/services/score_fusion.py

Fuses heuristic score + CNN visual score into a final CDT Risk Score (0–100).

Fusion formula:
  final_score = (heuristic_score × 0.65) + (cnn_score_0_100 × 0.35)

Rationale for 65/35 split:
  - Heuristic rubric is based on validated clinical CDT scoring criteria
    (Shulman 2000, Rouleau 1992) adapted for OpenCV extraction
  - CNN provides a learned visual complexity boost but without domain-specific
    training data it's less reliable than the explicit rules
  - Weight will shift toward 50/50 once fine-tuned weights are available
"""

from PIL import Image
from services.image_analyzer    import extract_image_features
from services.heuristic_scorer  import (
    compute_heuristic_score,
    derive_flags,
    derive_recommendation,
)
from services.cnn_scorer        import get_cnn_scorer
from utils.response_models      import ScoringResponse


HEURISTIC_WEIGHT = 0.65
CNN_WEIGHT       = 0.35

_RISK_LABELS = [
    "Cognitively Normal",
    "Subjective Cognitive Decline",
    "Mild Cognitive Impairment",
    "High Risk — Urgent Referral",
]


def _score_to_class(score: float) -> int:
    if score < 25: return 0
    if score < 50: return 1
    if score < 70: return 2
    return 3


def run_full_pipeline(img: Image.Image, dynamic_features: dict) -> ScoringResponse:
    """
    Full CDT scoring pipeline.

    Args:
        img: PIL Image of the submitted clock drawing
        dynamic_features: dict of motor features from the frontend

    Returns:
        ScoringResponse with cdtRiskScore, riskClass, riskLabel, flags, recommendation
    """

    # ── Step 1: Image feature extraction (OpenCV) ──────────────────────────────
    image_features = extract_image_features(img)

    # ── Step 2: Heuristic score (0–100) ────────────────────────────────────────
    heuristic_result = compute_heuristic_score(image_features, dynamic_features)
    heuristic_score  = heuristic_result["heuristic_score"]

    # ── Step 3: CNN visual score (0–1 → scale to 0–100) ───────────────────────
    scorer = get_cnn_scorer()
    cnn_raw = scorer.score(img)          # [0, 1]
    cnn_score_100 = cnn_raw * 100        # rescale to [0, 100]

    # ── Step 4: Weighted fusion ────────────────────────────────────────────────
    final_score = (heuristic_score * HEURISTIC_WEIGHT) + (cnn_score_100 * CNN_WEIGHT)
    final_score = round(min(100.0, max(0.0, final_score)), 1)

    # ── Step 5: Derive outputs ─────────────────────────────────────────────────
    risk_class  = _score_to_class(final_score)
    risk_label  = _RISK_LABELS[risk_class]
    flags       = derive_flags(image_features, dynamic_features, final_score)
    rec         = derive_recommendation(final_score)

    return ScoringResponse(
        cdtRiskScore   = final_score,
        riskClass      = risk_class,
        riskLabel      = risk_label,
        flags          = flags,
        recommendation = rec,
        breakdown      = {
            "heuristic_score":  heuristic_score,
            "cnn_score":        round(cnn_score_100, 1),
            "cnn_raw":          round(cnn_raw, 4),
            "image_features":   image_features,
            "dynamic_features": dynamic_features,
            "penalties":        heuristic_result["penalties"],
        },
    )
