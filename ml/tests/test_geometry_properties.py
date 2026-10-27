"""Properties of the reflex geometry over random inputs, mirroring what the app relies on."""

import math

import numpy as np
import pytest

from hirschberg.measure import Point, mirrored_asymmetry, reflex_offset

rng = np.random.default_rng(42)
CASES = [
    (
        Point(*rng.uniform(0, 4000, 2)),
        float(rng.uniform(5, 120)),
        Point(*rng.uniform(-3, 3, 2)),
    )
    for _ in range(300)
]


@pytest.mark.parametrize(("center", "radius", "offset"), CASES[:100])
def test_offset_round_trips_through_pixels(center, radius, offset):
    reflex = Point(center.x + offset.x * radius, center.y + offset.y * radius)
    back = reflex_offset(center, radius, reflex)
    assert back.x == pytest.approx(offset.x, abs=1e-9)
    assert back.y == pytest.approx(offset.y, abs=1e-9)


def test_offset_does_not_depend_on_position_or_scale():
    for center, radius, offset in CASES:
        reflex = Point(center.x + offset.x * radius, center.y + offset.y * radius)
        moved = reflex_offset(
            Point(center.x + 37, center.y - 11), radius, Point(reflex.x + 37, reflex.y - 11)
        )
        scaled = reflex_offset(
            Point(center.x * 2, center.y * 2), radius * 2, Point(reflex.x * 2, reflex.y * 2)
        )
        base = reflex_offset(center, radius, reflex)
        for other in (moved, scaled):
            assert other.x == pytest.approx(base.x, abs=1e-9)
            assert other.y == pytest.approx(base.y, abs=1e-9)


def test_symmetric_reflexes_give_zero_asymmetry():
    for _, _, offset in CASES:
        # Mirror images of each other: same vertical, opposite horizontal.
        a = mirrored_asymmetry(offset, Point(-offset.x, offset.y))
        assert a.x == pytest.approx(0, abs=1e-12) and a.y == pytest.approx(0, abs=1e-12)


def test_looking_away_with_both_eyes_doubles_the_horizontal_asymmetry():
    """Both eyes looking sideways move both reflexes the same way in the image.

    The mirroring that cancels the symmetric (angle kappa) offsets doubles this shift instead,
    so a child looking slightly away from the camera looks like a deviation. Frames where the
    child is not looking at the camera have to be rejected before the score is used.
    """
    for _, _, offset in CASES:
        a = mirrored_asymmetry(offset, offset)
        assert a.x == pytest.approx(2 * offset.x, abs=1e-12)
        assert a.y == pytest.approx(0, abs=1e-12)


def test_swapping_the_eyes_keeps_the_magnitude():
    for _, _, left in CASES:
        right = Point(*rng.uniform(-3, 3, 2))
        a = mirrored_asymmetry(left, right)
        b = mirrored_asymmetry(right, left)
        assert math.hypot(a.x, a.y) == pytest.approx(math.hypot(b.x, b.y), abs=1e-12)


@pytest.mark.parametrize("radius", [0, -1, float("nan")])
def test_offset_rejects_a_bad_radius(radius):
    with pytest.raises(ValueError):
        reflex_offset(Point(0, 0), radius, Point(1, 1))
