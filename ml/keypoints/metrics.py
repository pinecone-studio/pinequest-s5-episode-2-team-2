"""Errors normalized by the labelled iris radius, so they are comparable across crop sizes.

Inputs are N x 6 arrays in the dataset's target layout. For predictions the last column is
the reflex visibility probability (or 0/1 for the heuristic).
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np


def keypoint_errors(pred: np.ndarray, target: np.ndarray) -> dict[str, float]:
    radius = target[:, 2]
    center = np.hypot(pred[:, 0] - target[:, 0], pred[:, 1] - target[:, 1]) / radius
    radius_err = np.abs(pred[:, 2] - target[:, 2]) / radius
    pred_visible = pred[:, 5] >= 0.5
    true_visible = target[:, 5] >= 0.5
    both = pred_visible & true_visible
    reflex = (
        np.hypot(pred[both, 3] - target[both, 3], pred[both, 4] - target[both, 4]) / radius[both]
    )
    return {
        "n": int(len(target)),
        "center_median": float(np.median(center)),
        "center_p90": float(np.percentile(center, 90)),
        "radius_median": float(np.median(radius_err)),
        "reflex_median": float(np.median(reflex)) if both.any() else float("nan"),
        "reflex_p90": float(np.percentile(reflex, 90)) if both.any() else float("nan"),
        "reflex_visible_accuracy": float(np.mean(pred_visible == true_visible)),
    }


def markdown_table(rows: dict[str, dict[str, float]]) -> str:
    keys = [
        "n",
        "center_median",
        "center_p90",
        "radius_median",
        "reflex_median",
        "reflex_p90",
        "reflex_visible_accuracy",
    ]
    lines = ["| method | " + " | ".join(keys) + " |", "|---" * (len(keys) + 1) + "|"]
    for name, m in rows.items():
        cells = [str(m["n"])] + [f"{m[k]:.3f}" for k in keys[1:]]
        lines.append(f"| {name} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


INTERVAL_KEYS = ("center_median", "radius_median", "reflex_median")


def error_intervals(
    pred: np.ndarray,
    target: np.ndarray,
    groups: Sequence[str] | None = None,
    rounds: int = 1000,
    seed: int = 0,
) -> dict[str, tuple[float, float] | None]:
    """95% bootstrap intervals of the median errors.

    With `groups` (one person id per row) whole people are resampled, so crops of the same
    person are not counted as independent; otherwise single crops are.
    """
    rows = np.arange(len(target))
    clusters = (
        [rows[np.asarray(groups) == g] for g in sorted(set(groups))]
        if groups
        else list(rows[:, None])
    )
    rng = np.random.default_rng(seed)
    values: dict[str, list[float]] = {k: [] for k in INTERVAL_KEYS}
    for _ in range(rounds):
        picked = np.concatenate(
            [clusters[i] for i in rng.integers(len(clusters), size=len(clusters))]
        )
        m = keypoint_errors(pred[picked], target[picked])
        for k in INTERVAL_KEYS:
            if np.isfinite(m[k]):
                values[k].append(m[k])
    return {
        k: (float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))) if v else None
        for k, v in values.items()
    }


def interval_table(intervals: dict[str, dict[str, tuple[float, float] | None]]) -> str:
    lines = ["| method | " + " | ".join(f"{k} 95% CI" for k in INTERVAL_KEYS) + " |"]
    lines.append("|---" * (len(INTERVAL_KEYS) + 1) + "|")
    for name, ci in intervals.items():
        cells = [f"{c[0]:.3f}-{c[1]:.3f}" if c else "n/a" for c in (ci[k] for k in INTERVAL_KEYS)]
        lines.append(f"| {name} | " + " | ".join(cells) + " |")
    return "\n".join(lines)
