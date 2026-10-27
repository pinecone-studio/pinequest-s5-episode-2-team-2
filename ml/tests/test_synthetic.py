import math

import numpy as np
import pytest

from hirschberg.measure import Point, measure_eye
from hirschberg.synthetic import (
    HIRSCHBERG_RATIO,
    IRIS,
    IRIS_RADIUS_MM,
    PUPIL,
    REFLEX,
    SCLERA,
    EyeScene,
    offset_for_angle,
    prism_dioptres,
    render_eye,
)


def test_hirschberg_conversion():
    assert prism_dioptres(0) == 0
    assert prism_dioptres(45) == pytest.approx(100)
    # 8 prism dioptres is the refer target; it must map to the app's 0.069 iris radii.
    angle_8pd = math.degrees(math.atan(0.08))
    assert offset_for_angle(angle_8pd) == pytest.approx(8 / HIRSCHBERG_RATIO / IRIS_RADIUS_MM)
    assert offset_for_angle(angle_8pd) == pytest.approx(0.069, abs=0.001)
    assert offset_for_angle(-5) == pytest.approx(-offset_for_angle(5))


def test_render_places_parts_where_the_truth_says():
    eye = render_eye(EyeScene(iris_radius=40, angle_deg=5))
    img = eye.image
    assert img.dtype == np.uint8 and img.shape[0] == img.shape[1]
    c = eye.iris_center
    at = lambda p: int(img[int(round(p.y)), int(round(p.x))])  # noqa: E731
    assert at(eye.reflex) == REFLEX
    assert at(Point(c.x - 0.25 * 40, c.y)) == PUPIL
    assert at(Point(c.x - 0.7 * 40, c.y)) == IRIS
    assert at(Point(c.x - 1.5 * 40, c.y)) == SCLERA
    assert eye.reflex_offset.x == pytest.approx(offset_for_angle(5))
    assert eye.reflex.x - c.x == pytest.approx(offset_for_angle(5) * 40)


def test_same_seed_same_image_and_noise_needs_rng():
    scene = EyeScene(noise_sigma=8, blur_sigma=1)
    a = render_eye(scene, np.random.default_rng(1)).image
    b = render_eye(scene, np.random.default_rng(1)).image
    assert np.array_equal(a, b)
    with pytest.raises(ValueError):
        render_eye(scene)


def test_brightness_darkens_the_image():
    bright = render_eye(EyeScene()).image.mean()
    dark = render_eye(EyeScene(brightness=0.3)).image.mean()
    assert dark == pytest.approx(0.3 * bright, rel=0.05)


@pytest.mark.parametrize("angle", [0, 2.5, 5, 10, -5])
def test_measurement_recovers_the_offset_on_a_clean_eye(angle):
    eye = render_eye(EyeScene(iris_radius=40, angle_deg=angle, center_jitter=(0.3, -0.2)))
    rough = Point(eye.iris_center.x + 3, eye.iris_center.y - 2)
    measured = measure_eye(eye.image, "imageLeft", rough, 36)
    assert measured.reflex_offset is not None
    assert measured.reflex_offset.x == pytest.approx(eye.reflex_offset.x, abs=0.03)
    assert measured.reflex_offset.y == pytest.approx(0, abs=0.03)
