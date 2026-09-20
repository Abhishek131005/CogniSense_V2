#!/usr/bin/env python3
"""Train a public-data speech screening model for CogniSense.

This pipeline intentionally avoids clinicians or private labels. It uses public
multilingual corpora to build a weakly supervised screening model that outputs a
0-100 risk score. The resulting system is framed as a research screening model,
not a clinically validated dementia diagnosis.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import csv
from pathlib import Path
from typing import List

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

if __package__ in (None, ""):
    backend_root = Path(__file__).resolve().parents[1]
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

from services.speech_analyzer import get_speech_analyzer

csv.field_size_limit(10 * 1024 * 1024)

AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".webm", ".aac"}
DEFAULT_FEATURE_COLUMNS = [
    "duration_seconds",
    "pause_ratio",
    "total_silence_ratio",
    "speech_rate_syllables_per_min",
    "f0_mean_hz",
    "f0_std_hz",
    "f0_range_hz",
    "spectral_centroid_hz",
    "spectral_rolloff_hz",
    "spectral_bandwidth_hz",
    "zero_crossing_rate",
    "vocal_energy_mean",
    "vocal_energy_std",
    "type_token_ratio",
    "guiraud_r",
    "mean_word_length",
    "filler_word_ratio",
    "repetition_ratio",
    "hapax_ratio",
    "word_count",
    "unique_word_count",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Train a multilingual speech screening model using public corpora only. "
            "The model uses anomaly-based pseudo labels and a transparent tabular classifier."
        )
    )
    parser.add_argument(
        "--dataset-root",
        type=str,
        default="",
        help="Root directory containing public speech recordings. Supports nested language folders.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="",
        help="Directory where the trained model and report will be saved. Defaults to backend/models/public_speech",
    )
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=0,
        help="Maximum audio files to process; 0 processes the complete dataset.",
    )
    parser.add_argument(
        "--contamination",
        type=float,
        default=0.15,
        help="Expected anomaly fraction for pseudo labeling.",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="auto",
        help="Expected language hint for ASR/transcript extraction. Use 'auto' for detection.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Held-out portion for model validation.",
    )
    return parser.parse_args()


def resolve_audio_files(dataset_root: Path) -> List[Path]:
    if not dataset_root.exists():
        raise FileNotFoundError(f"Dataset root not found: {dataset_root}")

    files = []
    for path in dataset_root.rglob("*"):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS:
            files.append(path)
    return sorted(files)


def infer_group_id(audio_path: Path) -> str:
    parent = audio_path.parent.name.strip()
    stem = audio_path.stem.strip()
    if parent and parent.lower() not in {".", "..", "root"}:
        return parent
    if stem:
        return stem
    return audio_path.name


def safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def build_feature_row(
    audio_path: Path,
    language_hint: str,
    transcript: str = "",
    client_id: str = "",
) -> dict:
    analyzer = get_speech_analyzer()
    y, sr = analyzer._load_audio(str(audio_path))
    duration = len(y) / sr if sr > 0 else 0.0

    acoustic = analyzer._extract_acoustic(y, sr, duration)
    lexico = analyzer._extract_lexico(
        y,
        sr,
        language=language_hint,
        transcript_override=transcript,
    )

    row = {
        "audio_path": str(audio_path),
        "group_id": client_id or infer_group_id(audio_path),
        "language": (lexico.detected_language or language_hint or "auto"),
        "duration_seconds": round(duration, 3),
        "pause_ratio": safe_float(acoustic.pause_ratio),
        "total_silence_ratio": safe_float(acoustic.total_silence_ratio),
        "speech_rate_syllables_per_min": safe_float(acoustic.speech_rate_syllables_per_min),
        "f0_mean_hz": safe_float(acoustic.f0_mean_hz),
        "f0_std_hz": safe_float(acoustic.f0_std_hz),
        "f0_range_hz": safe_float(acoustic.f0_range_hz),
        "spectral_centroid_hz": safe_float(acoustic.spectral_centroid_hz),
        "spectral_rolloff_hz": safe_float(acoustic.spectral_rolloff_hz),
        "spectral_bandwidth_hz": safe_float(acoustic.spectral_bandwidth_hz),
        "zero_crossing_rate": safe_float(acoustic.zero_crossing_rate),
        "vocal_energy_mean": safe_float(acoustic.vocal_energy_mean),
        "vocal_energy_std": safe_float(acoustic.vocal_energy_std),
        "type_token_ratio": safe_float(lexico.type_token_ratio),
        "guiraud_r": safe_float(lexico.guiraud_r),
        "mean_word_length": safe_float(lexico.mean_word_length),
        "filler_word_ratio": safe_float(lexico.filler_word_ratio),
        "repetition_ratio": safe_float(lexico.repetition_ratio),
        "hapax_ratio": safe_float(lexico.hapax_ratio),
        "word_count": int(lexico.word_count),
        "unique_word_count": int(lexico.unique_word_count),
        "transcript": lexico.transcript,
    }
    return row


def read_common_voice_records(dataset_root: Path) -> list[dict]:
    records = []
    for language_dir in sorted(path for path in dataset_root.iterdir() if path.is_dir()):
        metadata_path = language_dir / "validated.tsv"
        clips_dir = language_dir / "clips"
        if not metadata_path.exists() or not clips_dir.is_dir():
            continue
        with metadata_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle, delimiter="\t")
            for item in reader:
                audio_path = clips_dir / str(item.get("path", "")).strip()
                if audio_path.is_file():
                    records.append(
                        {
                            "audio_path": audio_path,
                            "language": language_dir.name,
                            "transcript": str(item.get("sentence", "")).strip(),
                            "client_id": str(item.get("client_id", "")).strip(),
                        }
                    )
    return records


def collect_dataset(dataset_root: Path, language_hint: str, sample_limit: int) -> pd.DataFrame:
    records = read_common_voice_records(dataset_root)
    if records:
        if sample_limit <= 0:
            selected_records = records
        else:
            records_by_language = {}
            for record in records:
                records_by_language.setdefault(record["language"], []).append(record)
            selected_records = []
            language_names = sorted(records_by_language)
            language_index = 0
            while len(selected_records) < sample_limit and language_names:
                language = language_names[language_index % len(language_names)]
                language_records = records_by_language[language]
                if language_records:
                    selected_records.append(language_records.pop(0))
                language_names = [name for name in language_names if records_by_language[name]]
                language_index += 1
    else:
        files = resolve_audio_files(dataset_root)
        if not files:
            raise ValueError(f"No Common Voice validated records or audio files found under {dataset_root}")
        selected_records = [
            {"audio_path": path, "language": language_hint, "transcript": "", "client_id": ""}
            for path in (files if sample_limit <= 0 else files[:sample_limit])
        ]

    rows = []
    for record in selected_records:
        try:
            row = build_feature_row(
                record["audio_path"],
                record["language"] or language_hint,
                transcript=record["transcript"],
                client_id=record["client_id"],
            )
            rows.append(row)
        except Exception as exc:
            print(f"Skipping {record['audio_path']}: {exc}")

    if not rows:
        raise ValueError(f"No valid audio records could be processed under {dataset_root}")

    df = pd.DataFrame(rows)
    for col in DEFAULT_FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return df


def make_pseudo_labels(df: pd.DataFrame, contamination: float) -> pd.DataFrame:
    feature_cols = [col for col in DEFAULT_FEATURE_COLUMNS if col in df.columns]
    X = df[feature_cols].copy()
    model = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=200,
        n_jobs=-1,
    )
    model.fit(X)
    scores = model.decision_function(X)
    labels = model.predict(X)

    df = df.copy()
    if np.unique(labels).size == 1 and len(df) > 1:
        ranked_idx = np.argsort(scores)
        split_cut = max(1, min(len(df) - 1, len(df) // 2))
        labels = np.zeros(len(df), dtype=int)
        labels[ranked_idx[-split_cut:]] = 1

    df["pseudo_label"] = labels.astype(int)
    df["anomaly_score"] = -scores

    if df["pseudo_label"].nunique() < 2:
        ranked_idx = np.argsort(df["anomaly_score"].to_numpy())
        split_cut = max(1, min(len(df) - 1, len(df) // 2))
        backup = np.zeros(len(df), dtype=int)
        backup[ranked_idx[-split_cut:]] = 1
        df["pseudo_label"] = backup

    return df


def split_train_test(df: pd.DataFrame, test_size: float) -> tuple[pd.DataFrame, pd.DataFrame]:
    groups = df["group_id"].astype(str).tolist()
    label_counts = df["pseudo_label"].value_counts().to_dict()

    if len(label_counts) < 2 or min(label_counts.values()) < 2:
        from sklearn.model_selection import train_test_split

        n_test = max(1, int(round(len(df) * test_size)))
        if n_test >= len(df):
            n_test = max(1, len(df) - 1)
        train_idx, test_idx = train_test_split(
            np.arange(len(df)),
            test_size=n_test,
            random_state=42,
        )
        return df.iloc[train_idx].reset_index(drop=True), df.iloc[test_idx].reset_index(drop=True)

    if len(set(groups)) <= 1:
        from sklearn.model_selection import train_test_split

        train_idx, test_idx = train_test_split(
            np.arange(len(df)),
            test_size=test_size,
            stratify=df["pseudo_label"],
            random_state=42,
        )
        return df.iloc[train_idx].reset_index(drop=True), df.iloc[test_idx].reset_index(drop=True)

    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=42)
    train_idx, test_idx = next(splitter.split(df, groups=groups))
    return df.iloc[train_idx].reset_index(drop=True), df.iloc[test_idx].reset_index(drop=True)


def train_model(train_df: pd.DataFrame, test_df: pd.DataFrame) -> tuple[Pipeline, dict]:
    feature_cols = [col for col in DEFAULT_FEATURE_COLUMNS if col in train_df.columns]
    X_train = train_df[feature_cols].astype(float).values
    y_train = train_df["pseudo_label"].astype(int).values
    X_test = test_df[feature_cols].astype(float).values
    y_test = test_df["pseudo_label"].astype(int).values

    model = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)),
        ]
    )
    model.fit(X_train, y_train)
    proba = model.predict_proba(X_test)[:, 1]
    pred = model.predict(X_test)

    metrics = {
        "accuracy": float(accuracy_score(y_test, pred)),
        "precision": float(precision_score(y_test, pred, zero_division=0)),
        "recall": float(recall_score(y_test, pred, zero_division=0)),
        "f1": float(f1_score(y_test, pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, proba)) if len(np.unique(y_test)) > 1 else 0.0,
        "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
        "positive_rate": float(y_test.mean()),
        "n_train": int(len(train_df)),
        "n_test": int(len(test_df)),
    }
    return model, metrics


def calibrate_to_risk(model: Pipeline, df: pd.DataFrame) -> pd.DataFrame:
    feature_cols = [col for col in DEFAULT_FEATURE_COLUMNS if col in df.columns]
    scores = model.predict_proba(df[feature_cols].astype(float).values)[:, 1]
    calibrated = np.clip(scores, 1e-6, 1.0 - 1e-6)
    risk_0_100 = np.round(calibrated * 100.0, 2)
    result = df.copy()
    result["risk_score"] = risk_0_100
    result["risk_class"] = np.where(risk_0_100 >= 60, "high", np.where(risk_0_100 >= 40, "moderate", "low"))
    return result


def save_outputs(output_dir: Path, model: Pipeline, df: pd.DataFrame, metrics: dict, feature_cols: List[str]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "public_speech_screening_model.joblib"
    report_path = output_dir / "public_speech_screening_report.json"
    feature_path = output_dir / "feature_columns.json"
    dataset_path = output_dir / "public_speech_dataset.parquet"

    joblib.dump(model, model_path)
    feature_path.write_text(json.dumps(feature_cols, indent=2), encoding="utf-8")
    report = {
        "model_type": "LogisticRegression + StandardScaler",
        "task": "multilingual speech screening (weak supervision)",
        "dataset_summary": {
            "rows": int(len(df)),
            "positive_rate": float(df["pseudo_label"].mean()) if "pseudo_label" in df.columns else 0.0,
            "languages": sorted(df["language"].dropna().unique().tolist()),
        },
        "metrics": metrics,
        "disclaimer": (
            "This is an experimental multilingual speech screening model trained on public corpora "
            "with pseudo-labels. It is not a clinically validated dementia diagnosis system."
        ),
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    try:
        df.to_parquet(dataset_path, index=False)
    except Exception:
        df.to_csv(output_dir / "public_speech_dataset.csv", index=False)


def main() -> int:
    args = parse_args()

    dataset_root = Path(args.dataset_root).expanduser().resolve() if args.dataset_root else Path.cwd()
    output_dir = Path(args.output_dir).expanduser().resolve() if args.output_dir else Path(__file__).resolve().parents[1] / "models" / "public_speech"

    print(f"Scanning dataset root: {dataset_root}")
    df = collect_dataset(dataset_root, args.language, args.sample_limit)
    df = make_pseudo_labels(df, contamination=args.contamination)

    train_df, test_df = split_train_test(df, args.test_size)
    model, metrics = train_model(train_df, test_df)

    feature_cols = [col for col in DEFAULT_FEATURE_COLUMNS if col in train_df.columns]
    test_df = calibrate_to_risk(model, test_df)
    save_outputs(output_dir, model, test_df, metrics, feature_cols)

    print("\nPublic speech screening pipeline complete.")
    print(f"Model saved to: {output_dir / 'public_speech_screening_model.joblib'}")
    print(json.dumps(metrics, indent=2))
    print("\nDisclaimer: this is a screening model, not a clinically validated dementia diagnosis.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
