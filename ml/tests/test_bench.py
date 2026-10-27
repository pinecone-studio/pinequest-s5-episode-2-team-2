import math

import numpy as np
import pytest

from hirschberg.bench import (
    CONDITIONS,
    MEASUREMENT_SD_MM,
    REFER_ASYMMETRY,
    Trial,
    fit_slope,
    main,
    measure_scene,
    projected_score,
    repeatability_sd,
    run_vertical,
    scan_score,
    smallest_change,
    to_degrees,
    to_prism_dioptres,
    wilson,
)
from hirschberg.synthetic import EyeScene, offset_for_angle


def trials_with(sd: float, slope: float = 1.0, n: int = 50) -> list[Trial]:
    rng = np.random.default_rng(0)
    return [
        Trial(x, slope * x + float(rng.normal(0, sd)), 0.0, 0.0)
        for x in (-0.2, 0.0, 0.2)
        for _ in range(n)
    ]


def test_slope_and_repeatability_on_known_data():
    trials = trials_with(sd=0.01, slope=0.9)
    assert fit_slope(trials) == pytest.approx(0.9, abs=0.02)
    assert repeatability_sd(trials) == pytest.approx(0.01, rel=0.2)
    assert smallest_change(trials) == pytest.approx(1.96 * math.sqrt(2) * 0.01 / 0.9, rel=0.2)


def test_failed_trials_are_left_out_and_counted():
    trials = [Trial(0.0, None, 0.1, None), Trial(0.1, None, 0.1, None)]
    assert fit_slope(trials) is None and repeatability_sd(trials) is None
    assert smallest_change(trials) is None


def test_unit_conversions_are_inverse_of_the_renderer():
    offset = offset_for_angle(5)
    assert to_degrees(offset) == pytest.approx(5)
    assert to_prism_dioptres(REFER_ASYMMETRY) == pytest.approx(8, abs=0.05)


def test_wilson_interval():
    assert wilson(0, 0) is None
    lo, hi = wilson(5, 10)
    assert lo < 0.5 < hi


def test_measure_scene_reports_errors_against_the_truth():
    trial = measure_scene(EyeScene(angle_deg=5, noise_sigma=2), np.random.default_rng(3))
    assert trial.true_offset == pytest.approx(offset_for_angle(5))
    assert trial.measured_offset == pytest.approx(trial.true_offset, abs=0.05)
    assert trial.center_error < 0.1 and trial.reflex_error < 0.1


def test_scan_score_separates_straight_from_clearly_deviated_eyes():
    rng = np.random.default_rng(1)
    straight = scan_score(CONDITIONS["clean"], 0, rng)
    deviated = scan_score(CONDITIONS["clean"], 20, rng)
    assert straight < REFER_ASYMMETRY <= deviated


def test_cli_prints_the_report(capsys):
    assert main(["--trials", "2", "--scans", "1", "--seed", "1"]) == 0
    out = capsys.readouterr().out
    assert "# Synthetic bench test" in out
    assert "| clean |" in out and "| 20 PD |" in out
    assert "| vertical gaze (clean) |" in out
    with pytest.raises(SystemExit):
        main(["--trials", "1"])


def test_measurement_sd_matches_the_published_limits_of_agreement():
    assert MEASUREMENT_SD_MM * 1.96 * math.sqrt(2) == pytest.approx(0.18)


def test_projection_refers_around_the_target_and_not_straight_eyes():
    rng = np.random.default_rng(0)

    def referred(deviation: float) -> float:
        return sum(projected_score(deviation, rng) >= REFER_ASYMMETRY for _ in range(2000)) / 2000

    assert referred(0) < 0.01
    assert referred(4) < 0.05
    assert 0.3 < referred(8) < 0.7
    assert referred(20) > 0.99


def test_vertical_runs_compare_the_vertical_offset():
    trials = run_vertical(CONDITIONS["clean"], 2, np.random.default_rng(0))
    assert len(trials) == 14
    assert {round(t.true_offset, 6) for t in trials} == {
        round(offset_for_angle(a), 6) for a in (-10, -5, -2.5, 0, 2.5, 5, 10)
    }
    assert fit_slope(trials) == pytest.approx(1, abs=0.05)
