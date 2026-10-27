"""Analyses calibration scans (#8): how far the reflex moves per degree of gaze.

Usage: python -m hirschberg.calibration results.jsonl [results2.jsonl ...]

Input is the output of hirschberg.cli on frames taken from `C` captures. Each image must be
named after its capture (docs/capture-protocol.md section 6), optionally followed by
`_f<frame>`, for example `P007_C05L_r1_ip13_20261024_f12.jpg`. Other lines are ignored.
Prints a Markdown report; nothing is written.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import statistics
import sys
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np

FILE_NAME = re.compile(
    r"^(?P<person>P\d+)_C(?P<angle>\d{2})(?P<dir>[LR])?_r(?P<repeat>\d+)"
    r"_(?P<device>[a-z0-9]+)_(?P<date>\d{8})(?:_f\d+)?$"
)
# File name angle codes from the capture protocol: `25` means 2.5 degrees.
ANGLES = {"00": 0.0, "25": 2.5, "05": 5.0, "10": 10.0}
BOOTSTRAP_ROUNDS = 2000
Z95 = 1.96
# Mean visible iris radius (Rüfer et al., Cornea 2005;24:259-61), to turn iris radii into mm.
IRIS_RADIUS_MM = 11.71 / 2
# Published Hirschberg ratio in children, for comparison (Hasebe et al., IOVS 1998;39:2782-5).
PUBLISHED_RATIO = (19.9, 1.9)


@dataclass(frozen=True)
class Capture:
    person: str
    angle_deg: float
    """Signed: positive is the person's right."""
    repeat: int
    device: str
    shift: float | None
    """Median over frames of the mean horizontal reflex offset of both eyes."""
    asymmetry: float | None
    """Median over frames of the mirrored asymmetry magnitude."""
    frames: int
    failed: int


def capture_key(file_name: str) -> dict | None:
    match = FILE_NAME.match(Path(file_name).stem)
    if not match or match["angle"] not in ANGLES:
        return None
    angle = ANGLES[match["angle"]]
    if (angle == 0) != (match["dir"] is None):
        return None
    sign = -1 if match["dir"] == "L" else 1
    return {
        "person": match["person"],
        "angle_deg": sign * angle,
        "repeat": int(match["repeat"]),
        "device": match["device"],
    }


def frame_values(line: dict) -> tuple[float, float] | None:
    """(shift, asymmetry magnitude) of one frame, or None when it was not measured.

    Frames the CLI's quality check rejected (blur, closed eyes, turned head, ...) count as not
    measured, the same frames the app would drop.
    """
    eyes = line.get("eyes")
    if line.get("error") or not eyes or any(e.get("reflex_offset") is None for e in eyes):
        return None
    quality = line.get("quality")
    if quality is not None and not quality.get("ok", False):
        return None
    shift = sum(e["reflex_offset"]["x"] for e in eyes) / len(eyes)
    a = line.get("asymmetry")
    if a is None:
        return None
    return shift, math.hypot(a["x"], a["y"])


def group_captures(lines: Iterable[dict]) -> list[Capture]:
    groups: dict[tuple, list[tuple[float, float] | None]] = defaultdict(list)
    for line in lines:
        key = capture_key(line.get("file", ""))
        if key is not None:
            groups[tuple(key.items())].append(frame_values(line))
    captures = []
    for key, values in sorted(groups.items()):
        ok = [v for v in values if v is not None]
        captures.append(
            Capture(
                **dict(key),
                shift=statistics.median(v[0] for v in ok) if ok else None,
                asymmetry=statistics.median(v[1] for v in ok) if ok else None,
                frames=len(values),
                failed=len(values) - len(ok),
            )
        )
    return captures


def fit_slope(captures: Sequence[Capture]) -> tuple[float, float] | None:
    """Least-squares (slope per degree, intercept) of shift against angle."""
    pts = [(c.angle_deg, c.shift) for c in captures if c.shift is not None]
    if len({x for x, _ in pts}) < 2:
        return None
    slope, intercept = np.polyfit([x for x, _ in pts], [y for _, y in pts], 1)
    return float(slope), float(intercept)


def bootstrap_ci(
    captures: Sequence[Capture], stat, rounds: int = BOOTSTRAP_ROUNDS, seed: int = 0
) -> tuple[float, float] | None:
    """95% interval of stat(captures), resampling whole persons."""
    by_person: dict[str, list[Capture]] = defaultdict(list)
    for c in captures:
        by_person[c.person].append(c)
    people = list(by_person)
    if len(people) < 2:
        return None
    rng = np.random.default_rng(seed)
    values = []
    for _ in range(rounds):
        sample = [
            c for i in rng.integers(len(people), size=len(people)) for c in by_person[people[i]]
        ]
        value = stat(sample)
        if value is not None:
            values.append(value)
    if not values:
        return None
    lo, hi = np.percentile(values, [2.5, 97.5])
    return float(lo), float(hi)


def repeatability_sd(captures: Sequence[Capture]) -> float | None:
    """Pooled within-condition SD of the shift across repeats of the same person and angle."""
    groups: dict[tuple, list[float]] = defaultdict(list)
    for c in captures:
        if c.shift is not None:
            groups[(c.person, c.device, c.angle_deg)].append(c.shift)
    squares, dof = 0.0, 0
    for shifts in groups.values():
        if len(shifts) >= 2:
            mean = sum(shifts) / len(shifts)
            squares += sum((s - mean) ** 2 for s in shifts)
            dof += len(shifts) - 1
    return math.sqrt(squares / dof) if dof else None


def hirschberg_ratio(slope: float | None) -> float | None:
    """Prism dioptres per mm of reflex shift implied by a shift-per-degree slope.

    A slope of s iris radii per degree is s * IRIS_RADIUS_MM mm per degree, and a degree near
    straight ahead is 100 * tan(1 deg) prism dioptres.
    """
    if not slope:
        return None
    return 100 * math.tan(math.radians(1)) / (abs(slope) * IRIS_RADIUS_MM)


def per_person_ratios(captures: Sequence[Capture]) -> dict[str, float | None]:
    by_person: dict[str, list[Capture]] = defaultdict(list)
    for c in captures:
        by_person[c.person].append(c)
    return {
        person: hirschberg_ratio(fit[0] if (fit := fit_slope(own)) else None)
        for person, own in sorted(by_person.items())
    }


def wilson_ci(failed: int, total: int) -> tuple[float, float] | None:
    if total == 0:
        return None
    p = failed / total
    denom = 1 + Z95**2 / total
    centre = (p + Z95**2 / (2 * total)) / denom
    half = Z95 * math.sqrt(p * (1 - p) / total + Z95**2 / (4 * total**2)) / denom
    return max(0.0, centre - half), min(1.0, centre + half)


def _fmt(value: float | None, digits: int = 3) -> str:
    return "n/a" if value is None else f"{value:.{digits}f}"


def _fmt_ci(ci: tuple[float, float] | None, digits: int = 3) -> str:
    return "n/a" if ci is None else f"{ci[0]:.{digits}f} to {ci[1]:.{digits}f}"


def report(captures: Sequence[Capture]) -> str:
    frames = sum(c.frames for c in captures)
    failed = sum(c.failed for c in captures)
    people = len({c.person for c in captures})
    lines = [
        "# Calibration report",
        "",
        f"{len(captures)} captures, {people} people, {frames} frames.",
        "",
        "| Metric | Value | 95% CI |",
        "| --- | --- | --- |",
    ]

    fit = fit_slope(captures)
    slope = fit[0] if fit else None
    lines.append(
        f"| Shift per degree (iris radii) | {_fmt(slope, 4)} | "
        f"{_fmt_ci(bootstrap_ci(captures, lambda s: (f := fit_slope(s)) and f[0]), 4)} |"
    )
    sd = repeatability_sd(captures)
    lines.append(f"| Repeatability SD (iris radii) | {_fmt(sd, 4)} | n/a |")
    smallest = Z95 * math.sqrt(2) * sd / abs(slope) if sd is not None and slope else None
    prism = 100 * math.tan(math.radians(smallest)) if smallest is not None else None
    lines.append(
        f"| Smallest reliable change (degrees) | {_fmt(smallest, 2)} "
        f"({_fmt(prism, 1)} prism dioptres) | n/a |"
    )
    rate = failed / frames if frames else None
    lines.append(
        f"| Frame failure rate | {_fmt(rate)} ({failed}/{frames}) | "
        f"{_fmt_ci(wilson_ci(failed, frames))} |"
    )

    ratios = per_person_ratios(captures)
    known = [r for r in ratios.values() if r is not None]
    mean, sd = PUBLISHED_RATIO
    lines += [
        "",
        "Hirschberg ratio per person (prism dioptres per mm, assuming a "
        f"{IRIS_RADIUS_MM * 2:.2f} mm iris); published for children {mean} +/- {sd}:",
        "",
        "| Person | Ratio |",
        "| --- | --- |",
        *(f"| {person} | {_fmt(ratio, 1)} |" for person, ratio in ratios.items()),
        f"| All people (median) | {_fmt(statistics.median(known) if known else None, 1)} |",
    ]

    lines += [
        "",
        "Mirrored asymmetry by gaze angle (should stay near zero, both eyes turn together):",
        "",
        "| Angle | Captures | Median asymmetry | 95% CI |",
        "| --- | --- | --- | --- |",
    ]
    for angle in sorted({c.angle_deg for c in captures}):
        at = [c for c in captures if c.angle_deg == angle]

        def median_asym(s: Sequence[Capture]) -> float | None:
            values = [c.asymmetry for c in s if c.asymmetry is not None]
            return statistics.median(values) if values else None

        lines.append(
            f"| {angle:+g} deg | {len(at)} | {_fmt(median_asym(at))} | "
            f"{_fmt_ci(bootstrap_ci(at, median_asym))} |"
        )
    lines += [
        "",
        "Shift is the mean horizontal reflex offset of both eyes in image coordinates; positive",
        "angles are the person's right. The smallest reliable change is",
        "1.96 * sqrt(2) * SD / |slope|.",
        "Intervals resample whole people, so they are wide with few participants.",
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("results", type=Path, nargs="+")
    args = parser.parse_args(argv)
    lines = [
        json.loads(text)
        for path in args.results
        for text in path.read_text("utf8").splitlines()
        if text.strip()
    ]
    captures = group_captures(lines)
    if not captures:
        print(
            "No calibration captures found (see the file naming in the docstring).", file=sys.stderr
        )
        return 1
    print(report(captures))
    return 0


if __name__ == "__main__":
    sys.exit(main())
