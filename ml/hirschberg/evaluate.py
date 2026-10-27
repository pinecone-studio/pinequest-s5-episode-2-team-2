"""How well the asymmetry score separates deviated from normal captures (#8).

Usage: python -m hirschberg.evaluate results.jsonl [results2.jsonl ...] [--min-frames 5]

Input is hirschberg.cli output for frames of `N` (normal) and `D` (intentional deviation,
adults only) captures, named `<capture>_f<frame>.<ext>` as in docs/capture-protocol.md. Each
capture is summarized like a scan (hirschberg.summarize); `D` captures are positives, `N`
negatives. Prints a Markdown report: AUC, sensitivity and specificity at the app's threshold
(or `--threshold`) and at every candidate threshold, and the threshold with the highest Youden
index, each with 95% intervals that resample whole people. These are intentional deviations by adults, not patients: the numbers
describe the measurement, not clinical accuracy.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from dataset.prelabel import parse_name
from hirschberg.summarize import summarize_captures

BOOTSTRAP_ROUNDS = 2000
Z95 = 1.96
# The app's refer threshold (apps/mobile/src/features/scan/scanPolicy.ts): 8 prism dioptres.
APP_THRESHOLD = 0.069


@dataclass(frozen=True)
class Capture:
    name: str
    person: str
    device: str
    deviated: bool
    score: float | None
    frames_used: int


@dataclass(frozen=True)
class OperatingPoint:
    threshold: float
    sensitivity: float
    specificity: float
    true_positive: int
    false_negative: int
    true_negative: int
    false_positive: int

    @property
    def youden(self) -> float:
        return self.sensitivity + self.specificity - 1


def captures_from(lines: list[dict], min_frames: int) -> tuple[list[Capture], int]:
    """Labelled N and D captures with enough usable frames, and how many were too poor."""
    captures, too_poor = [], 0
    for name, summary in summarize_captures(lines).items():
        meta = parse_name(name)
        if meta is None or meta["scan_type"] not in ("N", "D"):
            continue
        if summary.frames_used < min_frames or summary.asymmetry_score is None:
            too_poor += 1
            continue
        captures.append(
            Capture(
                name=name,
                person=meta["person_id"],
                device=meta["device"],
                deviated=meta["scan_type"] == "D",
                score=summary.asymmetry_score,
                frames_used=summary.frames_used,
            )
        )
    return captures, too_poor


def operating_point(captures: Sequence[Capture], threshold: float) -> OperatingPoint:
    """A capture is flagged when its score is at or above the threshold, like decide()."""
    tp = sum(c.deviated and c.score >= threshold for c in captures)
    fn = sum(c.deviated and c.score < threshold for c in captures)
    tn = sum(not c.deviated and c.score < threshold for c in captures)
    fp = sum(not c.deviated and c.score >= threshold for c in captures)
    return OperatingPoint(
        threshold=threshold,
        sensitivity=tp / (tp + fn) if tp + fn else math.nan,
        specificity=tn / (tn + fp) if tn + fp else math.nan,
        true_positive=tp,
        false_negative=fn,
        true_negative=tn,
        false_positive=fp,
    )


def candidate_thresholds(captures: Sequence[Capture]) -> list[float]:
    """Every distinct score; each is where some capture changes side."""
    return sorted({c.score for c in captures})


def auc(captures: Sequence[Capture]) -> float | None:
    """Probability that a deviated capture scores above a normal one (ties count half)."""
    pos = [c.score for c in captures if c.deviated]
    neg = [c.score for c in captures if not c.deviated]
    if not pos or not neg:
        return None
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def best_threshold(captures: Sequence[Capture]) -> OperatingPoint | None:
    """Highest Youden index; ties go to the higher threshold (fewer false referrals)."""
    points = [operating_point(captures, t) for t in candidate_thresholds(captures)]
    points = [p for p in points if not math.isnan(p.youden)]
    return max(points, key=lambda p: (p.youden, p.threshold), default=None)


def bootstrap(captures: Sequence[Capture], stat, rounds: int = BOOTSTRAP_ROUNDS, seed: int = 0):
    """95% interval of stat(captures), resampling whole people; None when it cannot vary."""
    by_person: dict[str, list[Capture]] = defaultdict(list)
    for c in captures:
        by_person[c.person].append(c)
    people = sorted(by_person)
    if len(people) < 2:
        return None
    rng = np.random.default_rng(seed)
    values = []
    for _ in range(rounds):
        sample = [
            c for i in rng.integers(len(people), size=len(people)) for c in by_person[people[i]]
        ]
        value = stat(sample)
        if value is not None and not math.isnan(value):
            values.append(value)
    if not values:
        return None
    lo, hi = np.percentile(values, [2.5, 97.5])
    return float(lo), float(hi)


def device_table(captures: Sequence[Capture]) -> list[str]:
    """AUC per phone model, to spot a device where the measurement works worse."""
    devices = sorted({c.device for c in captures})
    if len(devices) < 2:
        return []
    rows = ["", "| Device | Captures | People | AUC |", "| --- | --- | --- | --- |"]
    for device in devices:
        own = [c for c in captures if c.device == device]
        people = len({c.person for c in own})
        rows.append(f"| {device} | {len(own)} | {people} | {_fmt(auc(own))} |")
    return rows


def _fmt(value: float | None, digits: int = 3) -> str:
    return "n/a" if value is None or math.isnan(value) else f"{value:.{digits}f}"


def _ci(ci: tuple[float, float] | None) -> str:
    return "n/a" if ci is None else f"{ci[0]:.3f} to {ci[1]:.3f}"


def report(captures: Sequence[Capture], too_poor: int, threshold: float = APP_THRESHOLD) -> str:
    pos = sum(c.deviated for c in captures)
    people = len({c.person for c in captures})
    lines = [
        "# Detection evaluation",
        "",
        f"{len(captures)} captures from {people} people: {pos} deviated (`D`), "
        f"{len(captures) - pos} normal (`N`). {too_poor} left out for too few usable frames.",
        "",
        "These are intentional deviations by adults; the numbers describe the measurement, not",
        "clinical accuracy.",
        "",
        f"AUC: {_fmt(auc(captures))} (95% CI {_ci(bootstrap(captures, auc))})",
    ]
    at = operating_point(captures, threshold)
    sens = bootstrap(captures, lambda s: operating_point(s, threshold).sensitivity)
    spec = bootstrap(captures, lambda s: operating_point(s, threshold).specificity)
    lines += [
        "",
        f"At the app's threshold {threshold:.3f}: sensitivity {_fmt(at.sensitivity)} "
        f"(95% CI {_ci(sens)}), specificity {_fmt(at.specificity)} (95% CI {_ci(spec)}); "
        f"TP {at.true_positive}, FN {at.false_negative}, TN {at.true_negative}, "
        f"FP {at.false_positive}.",
    ]
    best = best_threshold(captures)
    if best is not None:
        t = best.threshold
        sens = bootstrap(captures, lambda s: operating_point(s, t).sensitivity)
        spec = bootstrap(captures, lambda s: operating_point(s, t).specificity)
        lines += [
            "",
            f"Highest Youden index at threshold {t:.3f}: sensitivity {_fmt(best.sensitivity)} "
            f"(95% CI {_ci(sens)}), specificity {_fmt(best.specificity)} (95% CI {_ci(spec)}).",
        ]
    lines += device_table(captures)
    lines += [
        "",
        "| Threshold | Sensitivity | Specificity | TP | FN | TN | FP |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for t in candidate_thresholds(captures):
        p = operating_point(captures, t)
        lines.append(
            f"| {t:.3f} | {_fmt(p.sensitivity)} | {_fmt(p.specificity)} | "
            f"{p.true_positive} | {p.false_negative} | {p.true_negative} | {p.false_positive} |"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("results", type=Path, nargs="+")
    parser.add_argument("--min-frames", type=int, default=5)
    parser.add_argument(
        "--threshold", type=float, default=APP_THRESHOLD, help="refer threshold to report"
    )
    args = parser.parse_args(argv)
    lines = [
        json.loads(text)
        for path in args.results
        for text in path.read_text("utf8").splitlines()
        if text.strip()
    ]
    captures, too_poor = captures_from(lines, args.min_frames)
    if not captures:
        print("No N or D captures with enough usable frames.", file=sys.stderr)
        return 1
    print(report(captures, too_poor, args.threshold))
    return 0


if __name__ == "__main__":
    sys.exit(main())
