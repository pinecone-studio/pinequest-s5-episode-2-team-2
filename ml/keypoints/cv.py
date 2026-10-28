"""Person-level k-fold evaluation of the eye keypoint model (#244).

Usage: python -m keypoints.cv configs/keypoints-baseline.toml --folds 4

The manifest's train/val/test splits are ignored. People are dealt into k folds; each fold is
held out once while a fresh model trains on everyone else's crops with the config's settings.
Errors over all held-out crops are reported for the model and the heuristic, with intervals
that resample whole people. Writes runs/<run_name>-cv<k>/cv.json; no weights are kept.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import tomllib
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

from keypoints.data import EyeCrops, read_manifest
from keypoints.metrics import error_intervals, interval_table, keypoint_errors, markdown_table
from keypoints.train import fit, heuristic_vectors, pick_device, predict


def person_folds(rows: list[dict], k: int, seed: int) -> list[list[int]]:
    """Row indices per fold; all crops of one person land in the same fold."""
    if any(not row.get("person_id") for row in rows):
        raise ValueError("every manifest row needs a person_id for person-level folds")
    people = sorted({row["person_id"] for row in rows})
    if len(people) < k:
        raise ValueError(f"{len(people)} people cannot fill {k} folds")
    random.Random(seed).shuffle(people)
    fold_of = {person: i % k for i, person in enumerate(people)}
    folds: list[list[int]] = [[] for _ in range(k)]
    for i, row in enumerate(rows):
        folds[fold_of[row["person_id"]]].append(i)
    return folds


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("config", type=Path)
    parser.add_argument("--folds", type=int, default=4)
    args = parser.parse_args(argv)
    cfg = tomllib.loads(args.config.read_text())
    manifest = Path(cfg["manifest"])
    out_dir = Path(cfg.get("runs_dir", "runs")) / f"{cfg['run_name']}-cv{args.folds}"
    out_dir.mkdir(parents=True, exist_ok=True)

    random.seed(cfg["seed"])
    np.random.seed(cfg["seed"])
    torch.manual_seed(cfg["seed"])
    device = pick_device()
    size = cfg["image_size"]
    rows = read_manifest(manifest)
    try:
        folds = person_folds(rows, args.folds, cfg["seed"])
    except ValueError as e:
        print(e, file=sys.stderr)
        return 2

    preds = np.zeros((len(rows), 6), np.float32)
    targets = np.zeros((len(rows), 6), np.float32)
    for f, held in enumerate(folds):
        held_set = set(held)
        train_rows = [row for i, row in enumerate(rows) if i not in held_set]
        train = EyeCrops(manifest, "train", size, augment=True, rows=train_rows)
        test = EyeCrops(manifest, "test", size, rows=[rows[i] for i in held])
        model = fit(cfg, train, device)
        preds[held] = predict(model, DataLoader(test, 64), device)
        targets[held] = np.stack([t.numpy() for _, t in test])
        print(f"fold {f + 1}/{args.folds}: {len(held)} held-out crops", file=sys.stderr)

    people = [row["person_id"] for row in rows]
    results = {"model": keypoint_errors(preds, targets)}
    intervals = {"model": error_intervals(preds, targets, people)}
    h_pred, h_target = heuristic_vectors(manifest, rows)
    if len(h_pred):
        results["heuristic"] = keypoint_errors(h_pred, h_target)
        h_people = [p for p, row in zip(people, rows, strict=True) if row.get("heuristic")]
        intervals["heuristic"] = error_intervals(h_pred, h_target, h_people)
    report = {
        "config": cfg,
        "folds": args.folds,
        "fold_sizes": [len(held) for held in folds],
        "people": len(set(people)),
        "test": results,
        "intervals": intervals,
    }
    (out_dir / "cv.json").write_text(json.dumps(report, indent=2))
    print(markdown_table(results))
    print()
    print(interval_table(intervals))
    return 0


if __name__ == "__main__":
    sys.exit(main())
