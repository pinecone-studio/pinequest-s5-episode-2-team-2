"""Properties of the Python scan summary and policy, matching the TypeScript property tests."""

import math

import numpy as np
import pytest

from hirschberg.aggregate import Frame, ScanSummary, summarize_frames
from hirschberg.measure import Point
from hirschberg.policy import PolicyConfig, decide

# Test-only thresholds; they are not the app's values.
CONFIG = PolicyConfig(refer_asymmetry=0.07, min_frames_used=5, max_spread=0.1)
rng = np.random.default_rng(7)


def frame(deviation: float, ok: bool = True) -> Frame:
    return Frame(
        ok=ok, reasons=[] if ok else ["BLUR"], eyes_found=True, asymmetry=Point(deviation, 0)
    )


def scan(size: int) -> list[Frame]:
    return [frame(float(rng.uniform(0, 0.3)), ok=bool(rng.random() > 0.3)) for _ in range(size)]


SCANS = [scan(1 + i % 40) for i in range(200)]


def test_summary_does_not_depend_on_frame_order():
    for frames in SCANS:
        a = summarize_frames(frames)
        b = summarize_frames([frames[i] for i in rng.permutation(len(frames))])
        assert b.frames_used == a.frames_used
        if a.asymmetry_score is None:
            assert b.asymmetry_score is None
        else:
            assert b.asymmetry_score == pytest.approx(a.asymmetry_score, abs=1e-12)
            assert b.spread == pytest.approx(a.spread, abs=1e-12)


def test_rejected_frames_never_change_the_score():
    for frames in SCANS:
        usable = [f for f in frames if f.ok]
        extreme = frames + [frame(5, ok=False), frame(-5, ok=False)]
        assert summarize_frames(extreme).asymmetry_score == summarize_frames(usable).asymmetry_score


def test_score_stays_within_the_usable_values():
    for frames in SCANS:
        values = [math.hypot(f.asymmetry.x, f.asymmetry.y) for f in frames if f.ok]
        s = summarize_frames(frames)
        if not values:
            assert s.asymmetry_score is None
            continue
        assert min(values) - 1e-12 <= s.asymmetry_score <= max(values) + 1e-12
        assert s.spread >= 0


def summary(score, spread, used) -> ScanSummary:
    return ScanSummary(30, used, score, spread, ["BLUR"] if used < 30 else [])


GRID = [
    (score, spread, used)
    for score in (0, 0.03, 0.0699, 0.07, 0.0701, 0.3, 5)
    for spread in (0, 0.0999, 0.1, 0.1001)
    for used in (0, 4, 5, 30)
]


def test_model_failure_is_always_not_assessed():
    for failure in ("MODEL_UNAVAILABLE", "MODEL_ERROR", "TIMEOUT"):
        for g in GRID:
            assert decide(summary(*g), failure, CONFIG).outcome == "NOT_ASSESSED"


def test_no_visible_sign_needs_good_quality_below_the_threshold():
    for score, spread, used in GRID:
        if decide(summary(score, spread, used), None, CONFIG).outcome == "NO_VISIBLE_SIGN":
            assert used >= CONFIG.min_frames_used
            assert spread <= CONFIG.max_spread
            assert score < CONFIG.refer_asymmetry


def test_larger_score_never_looks_safer():
    rank = {"NO_VISIBLE_SIGN": 0, "REFER": 1}
    for spread in (0, 0.0999, 0.1):
        for used in (5, 30):
            ranks = [
                rank[decide(summary(s, spread, used), None, CONFIG).outcome]
                for s in (0, 0.03, 0.0699, 0.07, 0.0701, 0.3, 5)
            ]
            assert ranks == sorted(ranks)


def test_non_finite_measurements_are_never_judged():
    for bad in (None, math.nan, math.inf):
        for score, spread in ((bad, 0.01), (0.01, bad)):
            assert decide(summary(score, spread, 30), None, CONFIG).outcome == "NOT_ASSESSED"
