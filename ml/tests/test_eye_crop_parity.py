"""The training pipeline must feed the keypoint model what the app feeds it on device (#21).

App: eyeRegions + cropPixels sample the frame straight to 128 x 128. Training: prelabel cuts
the crop (crop_eye) and keypoints.data resizes it with OpenCV. Both read
apps/mobile/src/features/measurement/fixtures/eyeCrop.json, made by the TypeScript code.
"""

import json
import math
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np
import pytest

from dataset.prelabel import crop_eye
from hirschberg.cli import iris_estimates

FIXTURE = json.loads(
    (
        Path(__file__).parents[2] / "apps/mobile/src/features/measurement/fixtures/eyeCrop.json"
    ).read_text("utf8")
)
# OpenCV resizes 8-bit images with fixed-point weights and rounds to uint8, the app samples
# in float: allow two grey levels.
TOLERANCE = 2 / 255


def fixture_frame_bgr(width: int, height: int) -> np.ndarray:
    """Same formula as fixtureFrame in eyeCropFixture.ts (JS Math.round = floor(v + 0.5))."""
    y, x = np.mgrid[0:height, 0:width].astype(np.float64)
    rgb = np.stack(
        [
            (x * 3 + y) % 256,
            (x + y * 2 + 40) % 256,
            np.floor(127.5 + 127.5 * np.sin(x / 9) * np.cos(y / 7) + 0.5),
        ],
        axis=-1,
    ).astype(np.uint8)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def model_input(bgr: np.ndarray, cx: float, cy: float, radius: float, size: int):
    """prelabel's crop, then keypoints.data's resize, colour order and scaling."""
    crop, x0, y0 = crop_eye(bgr, cx, cy, radius)
    rgb = cv2.resize(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), (size, size))
    return rgb.astype(np.float32) / 255, x0, y0, crop.shape[0]


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda c: c["name"])
def test_training_crop_matches_the_app(case):
    width, height = FIXTURE["frame"]["width"], FIXTURE["frame"]["height"]
    bgr = fixture_frame_bgr(width, height)
    # Pixel coordinates with a scale of 1: normalizing and scaling back would move the
    # half-pixel ties (240.5 / 480 * 480 = 240.50000000000003) and test float noise instead.
    landmarks = [SimpleNamespace(x=0.0, y=0.0) for _ in range(478)]
    for i, p in enumerate(point for iris in case["irises"] for point in iris):
        landmarks[468 + i] = SimpleNamespace(x=p["x"], y=p["y"])

    irises = iris_estimates(landmarks, 1, 1)
    for (center, radius), expected in zip(irises, case["expected"], strict=True):
        pixels, x0, y0, side = model_input(bgr, center.x, center.y, radius, FIXTURE["outputSize"])
        assert {"x": x0, "y": y0, "size": side} == expected["crop"]
        for row, col, *rgb in expected["samples"]:
            assert pixels[row, col].tolist() == pytest.approx(rgb, abs=TOLERANCE)
        assert pixels.reshape(-1, 3).mean(axis=0).tolist() == pytest.approx(
            expected["mean"], abs=1 / 255
        )


def test_fixture_frame_matches_the_typescript_formula():
    # Spot values computed by hand from the formula in eyeCropFixture.ts.
    bgr = fixture_frame_bgr(640, 480)
    r, g, b = bgr[10, 100, 2], bgr[10, 100, 1], bgr[10, 100, 0]
    assert (r, g) == ((100 * 3 + 10) % 256, (100 + 10 * 2 + 40) % 256)
    assert b == math.floor(127.5 + 127.5 * math.sin(100 / 9) * math.cos(10 / 7) + 0.5)
