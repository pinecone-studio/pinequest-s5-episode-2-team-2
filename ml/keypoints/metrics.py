"""Errors normalized by the labelled iris radius, so they are comparable across crop sizes.

Inputs are N x 6 arrays in the dataset's target layout. For predictions the last column is
the reflex visibility probability (or 0/1 for the heuristic).
"""

from __future__ import annotations

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
