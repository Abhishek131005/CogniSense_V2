"""
backend/train/train_cnn.py

Fine-tunes a ResNet-18 on the synthetic CDT dataset.

Training setup:
  - Architecture: ResNet-18 pretrained on ImageNet (torchvision)
  - Final FC layer replaced: 512 → 2 (normal / impaired)
  - Only last 2 layers unfrozen (layer4 + fc) — feature extraction mode
  - Optimizer: Adam, lr=1e-4
  - Epochs: 15
  - Val split: 20% of dataset
  - Saves best weights to: backend/models/cdt_cnn.pth

Usage:
  cd backend
  python train/train_cnn.py

Expected output: ~85–92% validation accuracy on synthetic data
Runtime: ~5 mins on CPU, ~1 min on GPU
"""

import os
import sys
import time

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, models, transforms

# ── Paths ──────────────────────────────────────────────────────────────────────
DATA_DIR  = os.path.join(os.path.dirname(__file__), "data")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "cdt_cnn.pth")

# ── Hyperparameters ───────────────────────────────────────────────────────────
IMG_SIZE   = 224
BATCH_SIZE = 32
EPOCHS     = 15
LR         = 1e-4
VAL_SPLIT  = 0.20
DEVICE     = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Transforms ────────────────────────────────────────────────────────────────
TRAIN_TRANSFORM = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
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
    """Load the dataset and split into train/val."""
    if not os.path.isdir(DATA_DIR):
        print(f"\n[ERROR] Dataset not found at {DATA_DIR}")
        print("Please run first:  python train/generate_dataset.py\n")
        sys.exit(1)

    # ImageFolder expects: data/class_0_normal/, data/class_1_impaired/
    full_dataset = datasets.ImageFolder(DATA_DIR, transform=TRAIN_TRANSFORM)

    n_val   = int(len(full_dataset) * VAL_SPLIT)
    n_train = len(full_dataset) - n_val

    train_set, val_set = random_split(
        full_dataset, [n_train, n_val],
        generator=torch.Generator().manual_seed(42)
    )
    # Apply val transform separately
    val_set.dataset.transform = VAL_TRANSFORM

    train_loader = DataLoader(train_set, batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_set,   batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    print(f"Dataset: {len(train_set)} train | {len(val_set)} val")
    print(f"Classes: {full_dataset.classes}")
    return train_loader, val_loader


def train():
    os.makedirs(MODEL_DIR, exist_ok=True)
    print(f"\nDevice: {DEVICE}")

    train_loader, val_loader = load_data()
    model     = build_model()
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LR
    )
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.5)

    best_val_acc = 0.0

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
        model.eval()
        val_correct, val_total = 0, 0

        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                outputs = model(imgs)
                preds   = outputs.argmax(dim=1)
                val_correct += (preds == labels).sum().item()
                val_total   += imgs.size(0)

        val_acc = val_correct / val_total
        elapsed = time.time() - t0

        print(
            f"Epoch {epoch:2d}/{EPOCHS}  "
            f"loss={train_loss:.4f}  train_acc={train_acc:.3f}  "
            f"val_acc={val_acc:.3f}  ({elapsed:.1f}s)"
        )

        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), MODEL_PATH)
            print(f"  ✔ Saved best model (val_acc={val_acc:.3f}) → {MODEL_PATH}")

        scheduler.step()

    print(f"Training complete. Best val accuracy: {best_val_acc:.3f}")
    print(f"Model saved to: {MODEL_PATH}")
    print("\nRestart the API server to load the new weights:")
    print("  uvicorn main:app --reload --port 8000")


if __name__ == "__main__":
    train()
