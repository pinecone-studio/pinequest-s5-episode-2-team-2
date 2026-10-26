"""Builds the keypoint dataset from Label Studio exports.

Usage: python -m dataset.build <batch> <export.json>... [--out data/keypoints] [--seed 0]

<batch> is the folder with crops/ that was imported into Label Studio. Writes
<out>/manifest.jsonl in the format keypoints.train reads and copies the used crops to
<out>/crops/. People are split into train/val/test so that nobody is in two splits. Crops
flagged `unclear`, cancelled, unannotated or missing the iris points are left out.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import shutil
import sys
from pathlib import Path

SPLITS = (("train", 0.7), ("val", 0.15), ("test", 0.15))
META = ("person_id", "device", "distance_cm", "condition", "side", "source", "frame")


def read_points(result: list[dict]) -> tuple[dict[str, list[float]], set[str]]:
    """Keypoints in crop pixels by label, and the ticked flags, from a Label Studio result."""
    points, flags = {}, set()
    for item in result:
        value = item["value"]
        if item["type"] == "keypointlabels":
            x = value["x"] / 100 * item["original_width"]
            y = value["y"] / 100 * item["original_height"]
            points[value["keypointlabels"][0]] = [x, y]
        elif item["type"] == "choices":
            flags.update(value["choices"])
    return points, flags


def to_label(points: dict[str, list[float]]) -> dict | None:
    """Manifest label (iris_center, iris_radius, reflex), or None without both iris points."""
    if "iris_center" not in points or "iris_edge" not in points:
        return None
    (cx, cy), (ex, ey) = points["iris_center"], points["iris_edge"]
    return {
        "iris_center": [cx, cy],
        "iris_radius": math.hypot(ex - cx, ey - cy),
        "reflex": points.get("reflex"),
    }


def latest_annotation(task: dict) -> dict | None:
    done = [a for a in task.get("annotations", []) if not a.get("was_cancelled")]
    return max(done, key=lambda a: a.get("updated_at", ""), default=None)


def split_people(people: set[str], seed: int) -> dict[str, str]:
    """Shuffles people with a fixed seed and assigns whole people to splits by SPLITS."""
    order = sorted(people)
    random.Random(seed).shuffle(order)
    assignment, start = {}, 0
    for i, (name, fraction) in enumerate(SPLITS):
        end = len(order) if i == len(SPLITS) - 1 else start + max(1, round(fraction * len(order)))
        assignment.update({person: name for person in order[start:end]})
        start = end
    return assignment


def build(tasks: list[dict], seed: int) -> tuple[list[dict], dict[str, int]]:
    rows, skipped = {}, {}
    for task in tasks:
        annotation = latest_annotation(task)
        reason = None
        if annotation is None:
            reason = "UNANNOTATED"
        else:
            points, flags = read_points(annotation["result"])
            label = to_label(points)
            reason = "UNCLEAR" if "unclear" in flags else "MISSING_IRIS" if label is None else None
        if reason:
            skipped[reason] = skipped.get(reason, 0) + 1
            continue
        data = task["data"]
        row = {"crop": data["crop"], **label, **{k: data.get(k) for k in META}}
        if task.get("predictions"):
            row["heuristic"] = to_label(read_points(task["predictions"][0]["result"])[0])
        # A double-annotated crop keeps the last export's label.
        rows[data["crop"]] = row
    assignment = split_people({r["person_id"] for r in rows.values()}, seed)
    for row in rows.values():
        row["split"] = assignment[row["person_id"]]
    return list(rows.values()), skipped


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("batch", type=Path)
    parser.add_argument("exports", type=Path, nargs="+")
    parser.add_argument("--out", type=Path, default=Path("data/keypoints"))
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)

    tasks = [task for path in args.exports for task in json.loads(path.read_text())]
    rows, skipped = build(tasks, args.seed)
    if not rows:
        print("No usable annotations in the exports", file=sys.stderr)
        return 2
    (args.out / "crops").mkdir(parents=True, exist_ok=True)
    for row in rows:
        shutil.copy2(args.batch / row["crop"], args.out / "crops" / Path(row["crop"]).name)
        row["crop"] = f"crops/{Path(row['crop']).name}"
    with open(args.out / "manifest.jsonl", "w") as f:
        f.writelines(json.dumps(row) + "\n" for row in rows)

    for name, _ in SPLITS:
        people = {r["person_id"] for r in rows if r["split"] == name}
        crops = sum(r["split"] == name for r in rows)
        print(f"{name}: {crops} crops, {len(people)} people", file=sys.stderr)
    for reason, count in sorted(skipped.items()):
        print(f"skipped {count} {reason}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
