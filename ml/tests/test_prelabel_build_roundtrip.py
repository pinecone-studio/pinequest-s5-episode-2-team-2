"""Pre-labels written by dataset.prelabel must read back unchanged in dataset.build."""

import numpy as np
import pytest

from dataset.build import read_points, to_label
from dataset.prelabel import make_task
from hirschberg.measure import EyeMeasure, Point

rng = np.random.default_rng(5)
CASES = []
for _ in range(200):
    size = int(rng.integers(60, 400))
    x0, y0 = int(rng.integers(0, 3000)), int(rng.integers(0, 2000))
    r = float(rng.uniform(0.1, 0.25) * size)
    cx, cy = x0 + float(rng.uniform(0.3, 0.7) * size), y0 + float(rng.uniform(0.3, 0.7) * size)
    has_reflex = bool(rng.random() < 0.8)
    reflex = Point(cx + float(rng.uniform(-0.5, 0.5) * r), cy) if has_reflex else None
    eye = EyeMeasure("imageLeft", Point(cx, cy), r, reflex, None, 1.0)
    CASES.append((size, x0, y0, eye))


@pytest.mark.parametrize(("size", "x0", "y0", "eye"), CASES[:60])
def test_pre_labels_read_back_as_the_heuristic(size, x0, y0, eye):
    task = make_task("crop.png", size, eye, x0, y0, {"person_id": "P001"})
    points, flags = read_points(task["predictions"][0]["result"])
    label = to_label(points)
    heuristic = task["data"]["heuristic"]
    assert flags == set()
    assert label["iris_center"] == pytest.approx(heuristic["iris_center"], abs=1e-9)
    assert label["iris_radius"] == pytest.approx(heuristic["iris_radius"], abs=1e-9)
    if eye.reflex is None:
        assert label["reflex"] is None
    else:
        assert label["reflex"] == pytest.approx(heuristic["reflex"], abs=1e-9)


def test_crop_coordinates_are_inside_the_crop_as_percentages():
    for size, x0, y0, eye in CASES:
        task = make_task("crop.png", size, eye, x0, y0, {})
        for item in task["predictions"][0]["result"]:
            assert 0 <= item["value"]["x"] <= 100
            assert 0 <= item["value"]["y"] <= 100
            assert item["original_width"] == item["original_height"] == size
