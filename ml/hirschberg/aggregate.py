"""Combines the frames of one scan.

Reference for summarizeFrames in packages/core/src/aggregate.ts; both test suites check
packages/core/fixtures/aggregate.json.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Sequence
from dataclasses import dataclass

from hirschberg.measure import Point


@dataclass(frozen=True)
class Frame:
    ok: bool
    reasons: list[str]
    eyes_found: bool
    asymmetry: Point | None


@dataclass(frozen=True)
class ScanSummary:
    frames_total: int
    frames_used: int
    asymmetry_score: float | None
    spread: float | None
    quality_reasons: list[str]


def _usable(frame: Frame) -> float | None:
    if not frame.ok or not frame.eyes_found or frame.asymmetry is None:
        return None
    value = math.hypot(frame.asymmetry.x, frame.asymmetry.y)
    return value if math.isfinite(value) else None


def summarize_frames(frames: Sequence[Frame]) -> ScanSummary:
    """Median asymmetry magnitude of usable frames; spread is their median absolute deviation.

    Rejection reasons come most frequent first; ties keep first-appearance order.
    """
    used: list[float] = []
    # dict keeps first-appearance order, which breaks ties between equally frequent reasons.
    counts: dict[str, int] = {}
    for frame in frames:
        value = _usable(frame)
        if value is not None:
            used.append(value)
            continue
        reasons = (
            list(dict.fromkeys(frame.reasons))
            if frame.reasons
            else ["REFLEX_NOT_FOUND" if frame.eyes_found else "EYE_NOT_FOUND"]
        )
        for r in reasons:
            counts[r] = counts.get(r, 0) + 1
    score = statistics.median(used) if used else None
    return ScanSummary(
        frames_total=len(frames),
        frames_used=len(used),
        asymmetry_score=score,
        spread=None if score is None else statistics.median(abs(v - score) for v in used),
        quality_reasons=sorted(counts, key=lambda r: -counts[r]),
    )
