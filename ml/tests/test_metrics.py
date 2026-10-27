import numpy as np
import pytest

from keypoints.metrics import error_intervals, interval_table, keypoint_errors


def data(n: int = 40, noise: float = 0.5, seed: int = 0):
    rng = np.random.default_rng(seed)
    target = np.column_stack(
        [rng.uniform(20, 40, n), rng.uniform(20, 40, n), np.full(n, 10.0)]
        + [rng.uniform(20, 40, n), rng.uniform(20, 40, n), np.ones(n)]
    )
    pred = target.copy()
    pred[:, [0, 1, 3, 4]] += rng.normal(0, noise, (n, 4))
    pred[:, 2] += rng.normal(0, noise, n)
    return pred, target


def test_intervals_contain_the_point_estimate():
    pred, target = data()
    point = keypoint_errors(pred, target)
    ci = error_intervals(pred, target, rounds=300)
    for key in ("center_median", "radius_median", "reflex_median"):
        lo, hi = ci[key]
        assert lo <= point[key] <= hi
        assert hi - lo > 0


def test_grouping_by_person_widens_the_interval():
    # Four people, each with ten nearly identical crops but a person-specific error.
    rng = np.random.default_rng(1)
    pred, target = data(40, noise=0.0)
    people = [f"P{i // 10}" for i in range(40)]
    for i in range(4):
        pred[i * 10 : (i + 1) * 10, 0] += rng.uniform(0, 4)
    by_crop = error_intervals(pred, target, rounds=300)
    by_person = error_intervals(pred, target, people, rounds=300)
    width = lambda c: c[1] - c[0]  # noqa: E731
    assert width(by_person["center_median"]) > width(by_crop["center_median"])


def test_no_visible_reflex_gives_no_reflex_interval():
    pred, target = data(10)
    target[:, 5] = 0
    assert error_intervals(pred, target, rounds=50)["reflex_median"] is None


def test_interval_table():
    pred, target = data()
    text = interval_table({"model": error_intervals(pred, target, rounds=50)})
    assert text.splitlines()[0].startswith("| method | center_median 95% CI")
    assert text.splitlines()[2].startswith("| model | 0.")
    assert "n/a" in interval_table(
        {"x": {"center_median": None, "radius_median": None, "reflex_median": None}}
    )


def test_same_seed_same_interval():
    pred, target = data()
    assert error_intervals(pred, target, rounds=100, seed=3) == pytest.approx(
        error_intervals(pred, target, rounds=100, seed=3)
    )
