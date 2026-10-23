"""Trains the eye keypoint model and compares it with the heuristic on the test split.

Usage: python -m keypoints.train configs/keypoints-baseline.toml

Writes runs/<run_name>/model.pt (never committed) and metrics.json, and prints a markdown
table of model vs heuristic errors.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import tomllib
from pathlib import Path

import numpy as np
import timm
import torch
from torch import nn
from torch.nn import functional as F
from torch.utils.data import DataLoader

from keypoints.data import EyeCrops, label_vector
from keypoints.metrics import keypoint_errors, markdown_table


def build_model(pretrained: bool) -> nn.Module:
    """ImageNet MobileNetV3-Small with a regression head for the 6 target values."""
    backbone = timm.create_model("mobilenetv3_small_100", pretrained=pretrained, num_classes=0)
    # With num_classes=0 the pooled output comes after conv_head, so it has head_hidden_size.
    return nn.Sequential(backbone, nn.Linear(backbone.head_hidden_size, 6))


def loss_fn(out: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    # One element-wise loss over the five coordinates: column slices passed to smooth_l1_loss
    # are non-contiguous, which it rejects on MPS.
    coords = F.smooth_l1_loss(
        out[:, :5].contiguous(), target[:, :5].contiguous(), beta=0.01, reduction="none"
    )
    visible = target[:, 5]
    iris = coords[:, :3].mean()
    reflex = (coords[:, 3:5].sum(1) * visible).sum() / visible.sum().clamp(min=1)
    return iris + reflex + 0.1 * F.binary_cross_entropy_with_logits(out[:, 5], visible)


def pick_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def predict(model: nn.Module, loader: DataLoader, device: torch.device) -> np.ndarray:
    model.eval()
    outs = []
    with torch.no_grad():
        for images, _ in loader:
            out = model(images.to(device)).cpu()
            out[:, 5] = torch.sigmoid(out[:, 5])
            outs.append(out.numpy())
    return np.concatenate(outs)


def heuristic_vectors(manifest: Path, rows: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    """Heuristic predictions and labels for the test rows that have a heuristic result."""
    import cv2

    preds, targets = [], []
    for row in rows:
        if row.get("heuristic") is None:
            continue
        h, w = cv2.imread(str(manifest.parent / row["crop"])).shape[:2]
        preds.append(label_vector(row["heuristic"], w, h))
        targets.append(label_vector(row, w, h))
    return np.array(preds).reshape(-1, 6), np.array(targets).reshape(-1, 6)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("config", type=Path)
    args = parser.parse_args(argv)
    cfg = tomllib.loads(args.config.read_text())
    manifest = Path(cfg["manifest"])
    out_dir = Path(cfg.get("runs_dir", "runs")) / cfg["run_name"]
    out_dir.mkdir(parents=True, exist_ok=True)

    random.seed(cfg["seed"])
    np.random.seed(cfg["seed"])
    torch.manual_seed(cfg["seed"])
    device = pick_device()
    size = cfg["image_size"]
    train = EyeCrops(manifest, "train", size, augment=True)
    test = EyeCrops(manifest, "test", size)
    if len(train) == 0 or len(test) == 0:
        print(f"Need train and test rows in {manifest}", file=sys.stderr)
        return 2
    loader = DataLoader(
        train,
        batch_size=cfg["batch_size"],
        shuffle=True,
        generator=torch.Generator().manual_seed(cfg["seed"]),
    )

    model = build_model(cfg["pretrained"]).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=cfg["lr"], weight_decay=cfg["weight_decay"])
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=cfg["epochs"])
    for epoch in range(cfg["epochs"]):
        model.train()
        total = 0.0
        for images, target in loader:
            loss = loss_fn(model(images.to(device)), target.to(device))
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(images)
        sched.step()
        print(f"epoch {epoch + 1}/{cfg['epochs']} loss {total / len(train):.5f}", file=sys.stderr)

    torch.save(model.state_dict(), out_dir / "model.pt")
    test_targets = np.stack([t.numpy() for _, t in test])
    results = {"model": keypoint_errors(predict(model, DataLoader(test, 64), device), test_targets)}
    h_pred, h_target = heuristic_vectors(manifest, test.rows)
    if len(h_pred):
        results["heuristic"] = keypoint_errors(h_pred, h_target)
    (out_dir / "metrics.json").write_text(json.dumps({"config": cfg, "test": results}, indent=2))
    print(markdown_table(results))
    return 0


if __name__ == "__main__":
    sys.exit(main())
