"""Geometric properties of the Python landmark checks, matching qualityProperties.test.ts."""

import numpy as np
import pytest

from hirschberg.measure import Point
from hirschberg.quality import assess_quality, eye_openness, head_pose


def face(seed: int, cx: float = 500, cy: float = 550, s: float = 1) -> list[Point]:
    rng = np.random.default_rng(seed)

    def at(x: float, y: float) -> Point:
        return Point(cx + (x - 500) * s, cy + (y - 550) * s)

    lid = 4 + rng.random() * 10
    nose = (500 + (rng.random() - 0.5) * 120, 590 + (rng.random() - 0.5) * 80)
    tilt = (rng.random() - 0.5) * 40
    lm = [at(500, 550)] * 478
    for i, (x, y) in {
        33: (400, 500 - tilt),
        133: (460, 500 - tilt / 3),
        159: (430, 500 - lid - tilt * 0.7),
        145: (430, 500 + lid - tilt * 0.7),
        263: (600, 500 + tilt),
        362: (540, 500 + tilt / 3),
        386: (570, 500 - lid + tilt * 0.7),
        374: (570, 500 + lid + tilt * 0.7),
        234: (350, 560),
        454: (650, 560),
        1: nose,
        152: (500, 700),
    }.items():
        lm[i] = at(x, y)
    return lm


def reasons(lm: list[Point]) -> list[str]:
    return assess_quality((3840, 2160), 1, lm, (48, 48), (True, True)).reasons


SEEDS = range(300)


def test_moving_the_face_changes_nothing():
    for seed in SEEDS:
        assert reasons(face(seed, 2900, 1400)) == reasons(face(seed))


def test_scaling_keeps_pose_and_openness():
    for seed in SEEDS:
        a, b = head_pose(face(seed)), head_pose(face(seed, s=2.5))
        assert (b.yaw, b.pitch, b.roll) == pytest.approx((a.yaw, a.pitch, a.roll), abs=1e-9)
        assert eye_openness(face(seed, s=2.5)) == pytest.approx(eye_openness(face(seed)), abs=1e-9)
        assert reasons(face(seed, s=2.5)) == reasons(face(seed))


def test_a_mirrored_face_mirrors_yaw_and_roll():
    for seed in SEEDS:
        lm = face(seed)
        mirrored = [Point(1000 - p.x, p.y) for p in lm]
        a, b = head_pose(lm), head_pose(mirrored)
        assert b.yaw == pytest.approx(-a.yaw, abs=1e-9)
        assert b.roll == pytest.approx(-a.roll, abs=1e-9)
        assert b.pitch == pytest.approx(a.pitch, abs=1e-9)
        assert sorted(eye_openness(mirrored)) == pytest.approx(sorted(eye_openness(lm)))


def test_pose_is_finite_and_within_90_degrees():
    for seed in SEEDS:
        pose = head_pose(face(seed))
        for v in (pose.yaw, pose.pitch, pose.roll):
            assert np.isfinite(v) and abs(v) <= 90
