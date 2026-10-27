import cv2
import numpy as np
import pytest

from hirschberg.measure import (
    Point,
    find_reflex,
    measure_eye,
    mirrored_asymmetry,
    refine_iris,
    reflex_offset,
)


def synthetic_eye(iris: Point, radius: int, reflex: Point | None) -> np.ndarray:
    """Light sclera, dark iris disc and an optional small bright reflex."""
    image = np.full((200, 240), 190, np.uint8)
    cv2.circle(image, (int(iris.x), int(iris.y)), radius, 60, -1, cv2.LINE_AA)
    if reflex is not None:
        cv2.circle(image, (int(reflex.x), int(reflex.y)), 3, 255, -1, cv2.LINE_AA)
    return image


CASES = [
    (Point(120, 100), 30, Point(120, 100)),
    (Point(120, 100), 30, Point(128, 96)),
    (Point(90, 110), 24, Point(80, 115)),
    (Point(150, 90), 36, Point(170, 80)),
]


@pytest.mark.parametrize(("iris", "radius", "reflex"), CASES)
def test_refine_iris_within_one_pixel(iris, radius, reflex):
    image = synthetic_eye(iris, radius, reflex)
    rough = Point(iris.x + 4, iris.y - 3)
    center, r = refine_iris(image, rough, radius * 0.85)
    assert abs(center.x - iris.x) <= 1 and abs(center.y - iris.y) <= 1
    assert abs(r - radius) <= 1


@pytest.mark.parametrize(("iris", "radius", "reflex"), CASES)
def test_find_reflex_within_one_pixel(iris, radius, reflex):
    image = synthetic_eye(iris, radius, reflex)
    found, blobs = find_reflex(image, iris, radius)
    assert blobs == 1
    assert abs(found.x - reflex.x) <= 1 and abs(found.y - reflex.y) <= 1


def test_no_reflex():
    image = synthetic_eye(Point(120, 100), 30, None)
    assert find_reflex(image, Point(120, 100), 30) == (None, 0)
    eye = measure_eye(image, "imageLeft", Point(120, 100), 30)
    assert eye.reflex is None and eye.reflex_offset is None and eye.confidence == 0


def test_measure_eye_offset_is_normalized():
    image = synthetic_eye(Point(120, 100), 30, Point(129, 94))
    eye = measure_eye(image, "imageRight", Point(123, 98), 27)
    assert eye.reflex_offset.x == pytest.approx(9 / 30, abs=0.05)
    assert eye.reflex_offset.y == pytest.approx(-6 / 30, abs=0.05)
    assert eye.confidence == 1
    assert eye.reflex_count == 1


def test_reflex_offset_rejects_bad_radius():
    with pytest.raises(ValueError):
        reflex_offset(Point(0, 0), 0, Point(1, 1))


def test_mirrored_asymmetry():
    # Both reflexes slightly nasal: symmetric, so zero.
    assert mirrored_asymmetry(Point(0.1, 0.05), Point(-0.1, 0.05)) == Point(0, 0)
    assert mirrored_asymmetry(Point(0.3, 0), Point(0, 0)) == Point(0.3, 0)
