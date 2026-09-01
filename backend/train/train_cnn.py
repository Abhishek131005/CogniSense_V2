"""
backend/train/train_cnn.py

Fine-tunes a ResNet-18 on the CDT dataset.

Training setup:
  - Architecture: ResNet-18 pretrained on ImageNet (torchvision)
  - Final FC layer replaced: 512 → 2 (normal / impaired)
  - Only last 2 layers unfrozen (layer4 + fc) — feature extraction mode
  - Optimizer: Adam, lr=1e-4
  - Epochs: 15
    - Roboflow mode: reads train/valid/test CSV exports and maps scores 4-5 to
        normal and scores 0-3 to impaired; unlabeled rows are excluded
    - Legacy mode: uses a deterministic 20% validation split
  - Saves best weights to: backend/models/cdt_cnn.pth

Usage:
  cd backend
  python train/train_cnn.py

Set COGNISENSE_CDT_DATASET_ROOT to use the attached Roboflow export.
"""

import csv
import hashlib
import json
import os
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import datasets, models, transforms
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

# ── Paths ──────────────────────────────────────────────────────────────────────
DATA_DIR  = os.path.join(os.path.dirname(__file__), "data")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "cdt_cnn.pth")
REPORT_PATH = os.path.join(MODEL_DIR, "cdt_cnn_report.json")
ROBOFLOW_DIR = os.getenv("COGNISENSE_CDT_DATASET_ROOT", "").strip()

# ── Hyperparameters ───────────────────────────────────────────────────────────
IMG_SIZE   = 224
BATCH_SIZE = 32
EPOCHS     = 15
LR         = 1e-4
VAL_SPLIT  = 0.20
DEVICE     = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SEED       = 42

# ── Transforms ────────────────────────────────────────────────────────────────
TRAIN_TRANSFORM = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomRotation(5),
    transforms.RandomAffine(degrees=0, translate=(0.03, 0.03), scale=(0.95, 1.05)),
    transforms.ColorJitter(brightness=0.15, contrast=0.15),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])

VAL_TRANSFORM = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])


class RoboflowBinaryDataset(Dataset):
    """Read Roboflow classification CSVs and map CDT scores to two classes."""

    def __init__(self, split_dir: str, transform=None):
        self.split_dir = Path(split_dir)
        self.transform = transform
        csv_path = self.split_dir / "_classes.csv"
        if not csv_path.exists():
            raise FileNotFoundError(f"Roboflow labels not found: {csv_path}")

        with csv_path.open(newline="", encoding="utf-8-sig") as handle:
            rows = list(csv.DictReader(handle))

        self.samples = []
        score_columns = {}
        for column in rows[0].keys() if rows else []:
            normalized = column.strip().lower()
            if normalized.startswith("score "):
                try:
                    score = int(normalized.split()[1].split(":")[0])
                except (IndexError, ValueError):
                    continue
                score_columns.setdefault(score, []).append(column)

        seen_hashes = {}
        for row in rows:
            active_scores = [
                score for score, columns in score_columns.items()
                if any(str(row.get(column, "")).strip() == "1" for column in columns)
            ]
            if not active_scores:
                continue
            score = active_scores[0]
            label = 0 if score >= 4 else 1
            image_path = self.split_dir / str(row["filename"]).strip()
            if image_path.exists():
                digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
                previous = seen_hashes.get(digest)
                if previous is not None:
                    if previous[1] != label:
                        raise ValueError(
                            f"Duplicate image has conflicting labels: {previous[0]} and {image_path}"
                        )
                    continue
                seen_hashes[digest] = (image_path, label)
                self.samples.append((image_path, label, score))

        if not self.samples:
            raise ValueError(f"No labelled images found in {csv_path}")

        self.class_counts = {
            0: sum(label == 0 for _, label, _ in self.samples),
            1: sum(label == 1 for _, label, _ in self.samples),
        }

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        image_path, label, _ = self.samples[index]
        with Image.open(image_path) as image:
            image = image.convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, label


def build_model() -> nn.Module:
    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)

    # Freeze all parameters first
    for param in model.parameters():
        param.requires_grad = False

    # Unfreeze layer4 and final FC for fine-tuning
    for param in model.layer4.parameters():
        param.requires_grad = True

    # Replace FC with 2-class head
    model.fc = nn.Linear(model.fc.in_features, 2)  # fc is always trainable

    return model.to(DEVICE)


def load_data():
    """Load either the Roboflow CSV export or the legacy ImageFolder data."""
    if ROBOFLOW_DIR:
        train_set = RoboflowBinaryDataset(
            os.path.join(ROBOFLOW_DIR, "train"), transform=TRAIN_TRANSFORM
        )
        val_set = RoboflowBinaryDataset(
            os.path.join(ROBOFLOW_DIR, "valid"), transform=VAL_TRANSFORM
        )
        test_set = RoboflowBinaryDataset(
            os.path.join(ROBOFLOW_DIR, "test"), transform=VAL_TRANSFORM
        )
        print(f"Dataset: Roboflow binary baseline at {ROBOFLOW_DIR}")
        print(f"Train: {len(train_set)} | Valid: {len(val_set)}")
        print(f"Train class counts: {train_set.class_counts}")
        print(f"Valid class counts: {val_set.class_counts}")
        print(f"Test: {len(test_set)} | Test class counts: {test_set.class_counts}")
        return (
            DataLoader(train_set, batch_size=BATCH_SIZE, shuffle=True, num_workers=0),
            DataLoader(val_set, batch_size=BATCH_SIZE, shuffle=False, num_workers=0),
            DataLoader(test_set, batch_size=BATCH_SIZE, shuffle=False, num_workers=0),
        )

    if not os.path.isdir(DATA_DIR):
        print(f"\n[ERROR] Dataset not found at {DATA_DIR}")
        print("Please run first:  python train/generate_dataset.py\n")
        sys.exit(1)

    # ImageFolder expects: data/class_0_normal/, data/class_1_impaired/
    full_dataset = datasets.ImageFolder(DATA_DIR)
    indices = torch.randperm(len(full_dataset), generator=torch.Generator().manual_seed(42)).tolist()
    n_val = int(len(full_dataset) * VAL_SPLIT)
    train_indices, val_indices = indices[n_val:], indices[:n_val]
    train_base = datasets.ImageFolder(DATA_DIR, transform=TRAIN_TRANSFORM)
    val_base = datasets.ImageFolder(DATA_DIR, transform=VAL_TRANSFORM)
    train_set = torch.utils.data.Subset(train_base, train_indices)
    val_set = torch.utils.data.Subset(val_base, val_indices)

    train_loader = DataLoader(train_set, batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_set,   batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    print(f"Dataset: synthetic ImageFolder | {len(train_set)} train | {len(val_set)} val")
    print(f"Classes: {full_dataset.classes}")
    return train_loader, val_loader, None


def evaluate(model, loader):
    """Return paper-ready binary metrics and the confusion matrix."""
    if loader is None:
        return None
    model.eval()
    labels = []
    predictions = []
    probabilities = []
    with torch.no_grad():
        for images, batch_labels in loader:
            logits = model(images.to(DEVICE))
            labels.extend(batch_labels.tolist())
            predictions.extend(logits.argmax(dim=1).cpu().tolist())
            probabilities.extend(torch.softmax(logits, dim=1)[:, 1].cpu().tolist())

    metrics = {
        "accuracy": accuracy_score(labels, predictions),
        "balanced_accuracy": balanced_accuracy_score(labels, predictions),
        "precision_impaired": precision_score(labels, predictions, zero_division=0),
        "recall_impaired_sensitivity": recall_score(labels, predictions, zero_division=0),
        "specificity": recall_score(labels, predictions, pos_label=0, zero_division=0),
        "f1_impaired": f1_score(labels, predictions, zero_division=0),
        "confusion_matrix": confusion_matrix(labels, predictions, labels=[0, 1]).tolist(),
        "classification_report": classification_report(
            labels, predictions, labels=[0, 1], target_names=["normal", "impaired"],
            output_dict=True, zero_division=0,
        ),
    }
    if len(set(labels)) == 2:
        metrics["roc_auc"] = roc_auc_score(labels, probabilities)
    return metrics


def train():
    os.makedirs(MODEL_DIR, exist_ok=True)
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    print(f"\nDevice: {DEVICE}")

    train_loader, val_loader, test_loader = load_data()
    model = build_model()
    if ROBOFLOW_DIR:
        counts = train_loader.dataset.class_counts
        total = sum(counts.values())
        weights = torch.tensor(
            [total / (2 * counts[index]) for index in (0, 1)],
            dtype=torch.float32,
            device=DEVICE,
        )
        criterion = nn.CrossEntropyLoss(weight=weights)
        print(f"Class-weighted loss: {weights.detach().cpu().tolist()}")
    else:
        criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LR
    )
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.5)

    best_val_balanced_accuracy = 0.0

    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()

        # ── Train ──────────────────────────────────────────────────────────────
        model.train()
        running_loss, correct, total = 0.0, 0, 0

        for imgs, labels in train_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)

            optimizer.zero_grad()
            outputs = model(imgs)
            loss    = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * imgs.size(0)
            preds  = outputs.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total   += imgs.size(0)

        train_loss = running_loss / total
        train_acc  = correct / total

        # ── Validate ───────────────────────────────────────────────────────────
        val_metrics = evaluate(model, val_loader)
        val_acc = val_metrics["accuracy"]
        val_balanced_accuracy = val_metrics["balanced_accuracy"]
        elapsed = time.time() - t0

        print(
            f"Epoch {epoch:2d}/{EPOCHS}  "
            f"loss={train_loss:.4f}  train_acc={train_acc:.3f}  "
            f"val_acc={val_acc:.3f}  val_bal_acc={val_balanced_accuracy:.3f}  ({elapsed:.1f}s)"
        )

        # Save best model
        if val_balanced_accuracy > best_val_balanced_accuracy:
            best_val_balanced_accuracy = val_balanced_accuracy
            torch.save(model.state_dict(), MODEL_PATH)
            print(f"  Saved best model (val_bal_acc={val_balanced_accuracy:.3f}) -> {MODEL_PATH}")

        scheduler.step()

    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
    test_metrics = evaluate(model, test_loader)
    report = {
        "dataset": "roboflow" if ROBOFLOW_DIR else "synthetic",
        "dataset_root": ROBOFLOW_DIR or DATA_DIR,
        "seed": SEED,
        "device": str(DEVICE),
        "architecture": "resnet18",
        "class_map": {"0": "normal", "1": "impaired"},
        "train_transform": str(TRAIN_TRANSFORM),
        "eval_transform": str(VAL_TRANSFORM),
        "best_validation_balanced_accuracy": best_val_balanced_accuracy,
        "test_metrics": test_metrics,
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    print(f"Training complete. Best val balanced accuracy: {best_val_balanced_accuracy:.3f}")
    print(f"Model saved to: {MODEL_PATH}")
    print(f"Evaluation report saved to: {REPORT_PATH}")
    print("\nRestart the API server to load the new weights:")
    print("  uvicorn main:app --reload --port 8000")


if __name__ == "__main__":
    train()
