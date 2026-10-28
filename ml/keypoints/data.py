"""Eye-crop keypoint dataset read from a JSONL manifest.

One line per eye crop, written by the dataset builder:

    {"crop": "S03/P007_N_r1_L.png", "split": "train", "iris_center": [x, y],
     "iris_radius": r, "reflex": [x, y] or null, "heuristic": {same three keys, optional}}

Coordinates are in crop pixels and paths are relative to the manifest's folder. Targets are
returned normalized by the crop size: [cx, cy, r, reflex_x, reflex_y, reflex_visible].
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], np.float32)


def read_manifest(path: Path, split: str | None = None) -> list[dict]:
    """Rows of one split, or every row without `split`."""
    with open(path) as f:
        rows = [json.loads(line) for line in f if line.strip()]
    return [r for r in rows if split is None or r["split"] == split]


def label_vector(label: dict, width: int, height: int) -> np.ndarray:
    """Normalizes one label dict to [cx, cy, r, reflex_x, reflex_y, visible]."""
    cx, cy = label["iris_center"]
    reflex = label["reflex"]
    rx, ry = reflex if reflex is not None else (0.0, 0.0)
    return np.array(
        [
            cx / width,
            cy / height,
            label["iris_radius"] / width,
            rx / width,
            ry / height,
            float(reflex is not None),
        ],
        np.float32,
    )


def hflip(image: np.ndarray, target: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Mirrors the crop; x coordinates follow so labels stay on the same pixels."""
    target = target.copy()
    target[0] = 1.0 - target[0]
    if target[5] > 0:
        target[3] = 1.0 - target[3]
    return image[:, ::-1], target


class EyeCrops(Dataset):
    def __init__(
        self,
        manifest: Path,
        split: str,
        size: int,
        augment: bool = False,
        rows: list[dict] | None = None,
    ):
        """Crops of one manifest split, or the given `rows` of it (e.g. a cross-validation fold)."""
        self.root = manifest.parent
        self.rows = read_manifest(manifest, split) if rows is None else rows
        self.size = size
        self.augment = augment

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, i: int) -> tuple[torch.Tensor, torch.Tensor]:
        row = self.rows[i]
        bgr = cv2.imread(str(self.root / row["crop"]))
        if bgr is None:
            raise FileNotFoundError(self.root / row["crop"])
        h, w = bgr.shape[:2]
        image = cv2.resize(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), (self.size, self.size))
        target = label_vector(row, w, h)
        image = image.astype(np.float32) / 255
        if self.augment:
            if random.random() < 0.5:
                image, target = hflip(image, target)
            image = np.clip(image * random.uniform(0.7, 1.3), 0, 1)
            if random.random() < 0.3:
                image = cv2.GaussianBlur(np.ascontiguousarray(image), (5, 5), 0)
        image = (image - IMAGENET_MEAN) / IMAGENET_STD
        return torch.from_numpy(np.ascontiguousarray(image.transpose(2, 0, 1))), torch.from_numpy(
            target
        )
