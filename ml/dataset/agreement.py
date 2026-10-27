"""Checks how well two annotators agree on double-annotated crops (#34).

Usage: python -m dataset.agreement <export.json>...

Reads Label Studio JSON exports. A crop counts as double-annotated when it has completed
annotations from two different people, in one export or across several. Errors are in iris
radii (the mean of both labels), so crops of any size compare. Prints a Markdown report.
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from dataset.build import read_points, to_label


@dataclass(frozen=True)
class Pair:
    crop: str
    center: float | None
    radius: float | None
    reflex: float | None
    reflex_agrees: bool
    unclear_agrees: bool


def annotations_by_crop(tasks: list[dict]) -> dict[str, dict[str, list[dict]]]:
    """Completed annotation results per crop and annotator; the last one per person wins."""
    crops: dict[str, dict[str, tuple[str, list[dict]]]] = defaultdict(dict)
    for task in tasks:
        crop = task["data"]["crop"]
        for a in task.get("annotations", []):
            if a.get("was_cancelled"):
                continue
            person = a.get("completed_by")
            if isinstance(person, dict):
                person = person.get("id")
            if isinstance(person, bool) or not isinstance(person, (int, str)):
                continue
            person = str(person).strip()
            if not person:
                continue
            stamp = a.get("updated_at", "")
            if person not in crops[crop] or stamp >= crops[crop][person][0]:
                crops[crop][person] = (stamp, a["result"])
    return {c: {p: r for p, (_, r) in people.items()} for c, people in crops.items()}


def compare(crop: str, first: list[dict], second: list[dict]) -> Pair:
    """Compare flags for all pairs; point errors need two usable annotations."""
    (pa, fa), (pb, fb) = read_points(first), read_points(second)
    la, lb = to_label(pa), to_label(pb)
    center = radius = reflex = None
    if la and lb and "unclear" not in (fa | fb):
        scale = (la["iris_radius"] + lb["iris_radius"]) / 2
        if scale > 0:
            (ax, ay), (bx, by) = la["iris_center"], lb["iris_center"]
            center = math.hypot(ax - bx, ay - by) / scale
            radius = abs(la["iris_radius"] - lb["iris_radius"]) / scale
            if la["reflex"] and lb["reflex"]:
                (rx, ry), (sx, sy) = la["reflex"], lb["reflex"]
                reflex = math.hypot(rx - sx, ry - sy) / scale
    return Pair(
        crop=crop,
        center=center,
        radius=radius,
        reflex=reflex,
        reflex_agrees=("reflex" in pa) == ("reflex" in pb),
        unclear_agrees=("unclear" in fa) == ("unclear" in fb),
    )


def pairs(tasks: list[dict]) -> list[Pair]:
    result = []
    for crop, people in sorted(annotations_by_crop(tasks).items()):
        if len(people) >= 2:
            first, second = (people[p] for p in sorted(people)[:2])
            result.append(compare(crop, first, second))
    return result


def _stats(values: list[float]) -> str:
    if not values:
        return "n/a | n/a"
    p90 = sorted(values)[min(len(values) - 1, math.ceil(0.9 * len(values)) - 1)]
    return f"{statistics.median(values):.3f} | {p90:.3f}"


def report(found: list[Pair]) -> str:
    n = len(found)
    lines = [
        "# Annotation agreement",
        "",
        f"{n} double-annotated crops.",
        "",
        "| Measure (iris radii) | Pairs | Median | P90 |",
        "| --- | --- | --- | --- |",
    ]
    for name, values in (
        ("Iris centre distance", [p.center for p in found if p.center is not None]),
        ("Iris radius difference", [p.radius for p in found if p.radius is not None]),
        ("Reflex distance", [p.reflex for p in found if p.reflex is not None]),
    ):
        lines.append(f"| {name} | {len(values)} | {_stats(values)} |")
    if n:
        reflex = sum(p.reflex_agrees for p in found)
        unclear = sum(p.unclear_agrees for p in found)
        lines += [
            "",
            f"Reflex visible/absent agreement: {reflex}/{n}. "
            f"Unclear flag agreement: {unclear}/{n}.",
        ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("exports", type=Path, nargs="+")
    args = parser.parse_args(argv)
    tasks = [t for path in args.exports for t in json.loads(path.read_text("utf8"))]
    found = pairs(tasks)
    print(report(found))
    return 0 if found else 1


if __name__ == "__main__":
    sys.exit(main())
