"""Turns a scan summary into one outcome.

Reference for decide() in packages/core/src/policy.ts; both test suites check
packages/core/fixtures/policy.json. Rules are checked from the safest outcome down, so a
failed or poor-quality scan can never reach NO_VISIBLE_SIGN.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from hirschberg.aggregate import ScanSummary


@dataclass(frozen=True)
class PolicyConfig:
    refer_asymmetry: float
    min_frames_used: int
    max_spread: float

    def __post_init__(self) -> None:
        # A NaN threshold would make every comparison false and silently skip a rule.
        if not self.refer_asymmetry > 0:
            raise ValueError("refer_asymmetry must be positive")
        if not self.max_spread >= 0:
            raise ValueError("max_spread must be non-negative")
        if not (isinstance(self.min_frames_used, int) and self.min_frames_used >= 1):
            raise ValueError("min_frames_used must be a positive integer")


@dataclass(frozen=True)
class Decision:
    outcome: str
    reasons: list[str]


MODEL_ERROR = Decision("NOT_ASSESSED", ["MODEL_ERROR"])


def decide(summary: ScanSummary, failure: str | None, config: PolicyConfig) -> Decision:
    if failure:
        return Decision("NOT_ASSESSED", [failure])
    if summary.frames_used < config.min_frames_used:
        return Decision("RETAKE", [*dict.fromkeys(summary.quality_reasons), "TOO_FEW_FRAMES"])

    score, spread = summary.asymmetry_score, summary.spread
    if score is None or spread is None or not (math.isfinite(score) and math.isfinite(spread)):
        return MODEL_ERROR
    if spread > config.max_spread:
        return Decision("RETAKE", ["LOW_CONSISTENCY"])
    if score >= config.refer_asymmetry:
        return Decision("REFER", ["ASYMMETRY_ABOVE_THRESHOLD"])
    return Decision("NO_VISIBLE_SIGN", [])
