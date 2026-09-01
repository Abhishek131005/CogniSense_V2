"""Audit a Roboflow classification export before CDT model training.

Usage:
  python train/audit_roboflow.py "D:/All downloads/CDT_Dataset"
"""

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path

from PIL import Image


def audit_split(root: Path, split: str) -> dict:
    split_dir = root / split
    csv_path = split_dir / "_classes.csv"
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    score_columns = {}
    for column in rows[0].keys() if rows else []:
        normalized = column.strip().lower()
        if normalized.startswith("score "):
            try:
                score = int(normalized.split()[1].split(":")[0])
            except (IndexError, ValueError):
                continue
            score_columns.setdefault(score, []).append(column)

    labels = Counter()
    missing = []
    corrupt = []
    hashes = {}
    duplicate_files = []
    dimensions = Counter()

    for row in rows:
        filename = str(row.get("filename", "")).strip()
        path = split_dir / filename
        active_scores = [
            score for score, columns in score_columns.items()
            if any(str(row.get(column, "")).strip() == "1" for column in columns)
        ]
        label = "unlabeled" if not active_scores else f"score_{active_scores[0]}"
        labels[label] += 1

        if not path.exists():
            missing.append(filename)
            continue
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                dimensions[image.size] += 1
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest in hashes:
                duplicate_files.append((hashes[digest], filename))
            else:
                hashes[digest] = filename
        except Exception as exc:
            corrupt.append(f"{filename}: {exc}")

    return {
        "rows": len(rows),
        "labels": dict(labels),
        "missing": missing,
        "corrupt": corrupt,
        "duplicate_files": duplicate_files,
        "dimensions": {str(key): value for key, value in dimensions.items()},
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python train/audit_roboflow.py DATASET_ROOT")
        return 2

    root = Path(sys.argv[1]).resolve()
    if not root.exists():
        print(f"Dataset root does not exist: {root}")
        return 2

    all_duplicates = []
    global_hashes = {}
    cross_split_duplicates = []
    for split in ("train", "valid", "test"):
        result = audit_split(root, split)
        print(f"\n[{split}]")
        print(f"CSV rows: {result['rows']}")
        print(f"Labels: {result['labels']}")
        print(f"Dimensions: {result['dimensions']}")
        print(f"Missing: {len(result['missing'])}")
        print(f"Corrupt: {len(result['corrupt'])}")
        print(f"Exact duplicates within split: {len(result['duplicate_files'])}")
        all_duplicates.extend((split, pair) for pair in result["duplicate_files"])

        split_dir = root / split
        for path in split_dir.iterdir():
            if not path.is_file() or path.name == "_classes.csv":
                continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest in global_hashes and global_hashes[digest][0] != split:
                cross_split_duplicates.append((global_hashes[digest], (split, path.name)))
            else:
                global_hashes[digest] = (split, path.name)

    print(f"\nTotal within-split duplicate pairs: {len(all_duplicates)}")
    print(f"Exact duplicates across splits: {len(cross_split_duplicates)}")
    if cross_split_duplicates:
        print("First cross-split duplicate pairs:")
        for pair in cross_split_duplicates[:10]:
            print(f"  {pair}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
