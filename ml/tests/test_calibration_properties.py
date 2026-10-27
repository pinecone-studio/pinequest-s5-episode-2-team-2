"""Properties of the calibration statistics over generated sessions."""

from dataclasses import replace

import numpy as np
import pytest

from hirschberg.calibration import Capture, bootstrap_ci, fit_slope, repeatability_sd, wilson_ci

ANGLES = (-10.0, -5.0, -2.5, 0.0, 2.5, 5.0, 10.0)


def session(
    seed: int, slope: float = 0.015, noise: float = 0.004, people: int = 5
) -> list[Capture]:
    rng = np.random.default_rng(seed)
    out = []
    for p in range(people):
        kappa = float(rng.normal(0, 0.03))
        for angle in ANGLES:
            for repeat in (1, 2):
                shift = slope * angle + kappa + float(rng.normal(0, noise))
                out.append(Capture(f"P{p:03d}", angle, repeat, "ip13", shift, 0.01, 10, 0))
    return out


SESSIONS = [session(s) for s in range(40)]


def shifted(captures, by):
    return [replace(c, shift=c.shift + by) for c in captures]


def scaled(captures, k):
    return [replace(c, shift=c.shift * k) for c in captures]


def test_a_constant_offset_changes_neither_slope_nor_repeatability():
    for captures in SESSIONS:
        slope, _ = fit_slope(captures)
        moved, _ = fit_slope(shifted(captures, 0.2))
        assert moved == pytest.approx(slope, abs=1e-9)
        assert repeatability_sd(shifted(captures, 0.2)) == pytest.approx(repeatability_sd(captures))


def test_scaling_the_shifts_scales_slope_and_repeatability():
    for captures in SESSIONS:
        slope, _ = fit_slope(captures)
        assert fit_slope(scaled(captures, 3))[0] == pytest.approx(3 * slope)
        assert repeatability_sd(scaled(captures, 3)) == pytest.approx(
            3 * repeatability_sd(captures)
        )


def test_the_fit_recovers_the_true_slope_on_average():
    slopes = [fit_slope(c)[0] for c in SESSIONS]
    assert np.mean(slopes) == pytest.approx(0.015, abs=0.0005)


def test_the_person_level_interval_contains_the_estimate():
    for captures in SESSIONS[:10]:
        slope, _ = fit_slope(captures)
        lo, hi = bootstrap_ci(captures, lambda s: (f := fit_slope(s)) and f[0], rounds=300)
        assert lo <= slope <= hi


def test_noise_free_repeats_have_zero_repeatability():
    captures = session(1, noise=0.0)
    assert repeatability_sd(captures) == pytest.approx(0, abs=1e-12)


def test_wilson_interval_contains_the_rate_and_narrows_with_more_frames():
    for failed, total in [(0, 10), (3, 10), (10, 10), (30, 100), (300, 1000)]:
        lo, hi = wilson_ci(failed, total)
        assert 0 <= lo <= failed / total <= hi <= 1
    assert (lambda c: c[1] - c[0])(wilson_ci(300, 1000)) < (lambda c: c[1] - c[0])(wilson_ci(3, 10))
