"""Properties of the detection evaluation over generated sets of captures."""

import math
from dataclasses import replace

import numpy as np
import pytest

from hirschberg.evaluate import Capture, auc, best_threshold, candidate_thresholds, operating_point


def captures(seed: int, n: int = 40) -> list[Capture]:
    rng = np.random.default_rng(seed)
    out = []
    for i in range(n):
        deviated = bool(rng.random() < 0.5)
        score = float(rng.normal(0.15 if deviated else 0.03, 0.04))
        out.append(Capture(f"c{i}", f"P{i % 8}", "ip13", deviated, abs(score), 10))
    return out


SETS = [captures(s) for s in range(60)]


def test_raising_the_threshold_never_raises_sensitivity_or_lowers_specificity():
    for cs in SETS:
        points = [operating_point(cs, t) for t in candidate_thresholds(cs)]
        for a, b in zip(points, points[1:], strict=False):
            assert b.sensitivity <= a.sensitivity + 1e-12
            assert b.specificity >= a.specificity - 1e-12


def test_confusion_counts_add_up():
    for cs in SETS:
        pos = sum(c.deviated for c in cs)
        for t in candidate_thresholds(cs)[::5]:
            p = operating_point(cs, t)
            assert p.true_positive + p.false_negative == pos
            assert p.true_negative + p.false_positive == len(cs) - pos


def test_swapping_the_labels_mirrors_the_auc():
    for cs in SETS:
        flipped = [replace(c, deviated=not c.deviated) for c in cs]
        assert auc(flipped) == pytest.approx(1 - auc(cs))


def test_a_monotonic_change_of_score_keeps_the_auc():
    for cs in SETS:
        squashed = [replace(c, score=math.sqrt(c.score)) for c in cs]
        assert auc(squashed) == pytest.approx(auc(cs))


def test_the_best_threshold_is_a_candidate_with_the_highest_youden_index():
    for cs in SETS:
        best = best_threshold(cs)
        youdens = [operating_point(cs, t).youden for t in candidate_thresholds(cs)]
        assert best.threshold in candidate_thresholds(cs)
        assert best.youden == pytest.approx(max(youdens))
