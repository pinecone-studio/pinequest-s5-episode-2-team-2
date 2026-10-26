import cv2
import numpy as np

from hirschberg.cli import eye_crop_stats, frame_quality
from hirschberg.measure import EyeMeasure, Point


def textured(value: int = 120) -> np.ndarray:
    """A mid-grey frame with fine noise, so crops are neither flat nor clipped."""
    rng = np.random.default_rng(0)
    return np.clip(rng.normal(value, 25, (2160, 3840)), 0, 255).astype(np.uint8)


def eye(x: float, reflex: bool = True) -> EyeMeasure:
    center = Point(x, 1080)
    offset = Point(0.05, 0) if reflex else None
    return EyeMeasure("imageLeft", center, 48, center if reflex else None, offset, 0.9)


def face() -> list[Point]:
    lm = [Point(1920, 1150)] * 478
    points = {
        33: (1700, 1080), 133: (1760, 1080), 159: (1730, 1068), 145: (1730, 1092),
        263: (2140, 1080), 362: (2080, 1080), 386: (2110, 1068), 374: (2110, 1092),
        234: (1550, 1160), 454: (2290, 1160), 1: (1920, 1196), 152: (1920, 1430),
    }  # fmt: skip
    for i, (x, y) in points.items():
        lm[i] = Point(x, y)
    return lm


def test_crop_stats_match_the_app_crop():
    gray = textured()
    stats = eye_crop_stats(gray, Point(1720, 1080), 48)
    assert 0.4 < stats.exposure < 0.55
    assert stats.clipped == 0
    blurred = eye_crop_stats(cv2.GaussianBlur(gray, (0, 0), 8), Point(1720, 1080), 48)
    assert blurred.sharpness < stats.sharpness / 10


def test_crop_near_the_edge_and_too_small():
    assert eye_crop_stats(textured(), Point(5, 5), 48) is not None
    assert eye_crop_stats(textured(), Point(100, 100), 0.4) is None


def test_frame_quality_reports_pixel_and_reflex_reasons():
    good = frame_quality(textured(), face(), [eye(1730), eye(2110)])
    assert good.reasons == []
    assert good.sharpness is not None and good.head_pose is not None
    dark = frame_quality(textured(10), face(), [eye(1730), eye(2110, reflex=False)])
    assert dark.reasons == ["TOO_DARK", "REFLEX_NOT_FOUND"]
