"""Per-eye measurement on a grayscale image.

Mirrors the contracts in packages/core/src/types.ts and geometry.ts. All offsets are
unitless (normalized by the iris radius); there is no millimetre or degree conversion.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import cv2
import numpy as np

EyeSide = Literal["imageLeft", "imageRight"]


@dataclass(frozen=True)
class Point:
    x: float
    y: float


@dataclass(frozen=True)
class EyeMeasure:
    side: EyeSide
    iris_center: Point
    iris_radius: float
    reflex: Point | None
    reflex_offset: Point | None
    confidence: float


def reflex_offset(iris_center: Point, iris_radius: float, reflex: Point) -> Point:
    if not iris_radius > 0:
        raise ValueError("iris_radius must be positive")
    return Point(
        (reflex.x - iris_center.x) / iris_radius,
        (reflex.y - iris_center.y) / iris_radius,
    )


def mirrored_asymmetry(image_left: Point, image_right: Point) -> Point:
    """Mirrors the image-right offset horizontally so symmetric reflexes give zero."""
    return Point(image_left.x + image_right.x, image_left.y - image_right.y)


def _crop(gray: np.ndarray, center: Point, half: int) -> tuple[np.ndarray, int, int]:
    x0 = max(int(round(center.x)) - half, 0)
    y0 = max(int(round(center.y)) - half, 0)
    x1 = min(int(round(center.x)) + half + 1, gray.shape[1])
    y1 = min(int(round(center.y)) + half + 1, gray.shape[0])
    return gray[y0:y1, x0:x1], x0, y0


def refine_iris(gray: np.ndarray, center: Point, radius: float) -> tuple[Point, float] | None:
    """Refines a rough iris estimate by fitting a circle to the dark iris blob.

    Bright spots inside the iris (the reflex) are filled before fitting.
    """
    roi, x0, y0 = _crop(gray, center, int(math.ceil(radius * 1.6)))
    if roi.size == 0:
        return None
    blurred = cv2.GaussianBlur(roi, (3, 3), 0)
    _, dark = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    seed = (center.x - x0, center.y - y0)
    inside = [c for c in contours if cv2.pointPolygonTest(c, seed, False) >= 0]
    if not inside:
        return None
    (cx, cy), r = cv2.minEnclosingCircle(max(inside, key=cv2.contourArea))
    if r < radius * 0.5 or r > radius * 1.5:
        return None
    return Point(cx + x0, cy + y0), float(r)


def find_reflex(
    gray: np.ndarray, iris_center: Point, iris_radius: float
) -> tuple[Point | None, int]:
    """Finds the brightest blob inside the iris disc.

    Returns the intensity-weighted centroid of the largest bright blob and the number of
    bright blobs found.
    """
    roi, x0, y0 = _crop(gray, iris_center, int(math.ceil(iris_radius)))
    if roi.size == 0:
        return None, 0
    # TODO(tune): margin, contrast and threshold ratios are placeholders until calibration data.
    # The margin keeps bright sclera at the iris edge out of the search disc.
    search_radius = iris_radius - max(2.0, 0.1 * iris_radius)
    disc = np.zeros(roi.shape, np.uint8)
    cv2.circle(
        disc,
        (int(round(iris_center.x)) - x0, int(round(iris_center.y)) - y0),
        int(round(search_radius)),
        255,
        -1,
    )
    values = roi[disc > 0]
    peak, median = float(values.max()), float(np.median(values))
    if peak - median < 0.25 * 255:
        return None, 0
    bright = ((roi >= median + 0.6 * (peak - median)) & (disc > 0)).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(bright)
    if count < 2:
        return None, 0
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    ys, xs = np.nonzero(labels == largest)
    weights = roi[ys, xs].astype(np.float64)
    cx = float(np.average(xs, weights=weights)) + x0
    cy = float(np.average(ys, weights=weights)) + y0
    return Point(cx, cy), count - 1


def measure_eye(gray: np.ndarray, side: EyeSide, center: Point, radius: float) -> EyeMeasure:
    refined = refine_iris(gray, center, radius)
    if refined is not None:
        center, radius = refined
    reflex, blobs = find_reflex(gray, center, radius)
    offset = reflex_offset(center, radius, reflex) if reflex else None
    # TODO(tune): heuristic confidence until a calibrated score exists.
    confidence = 0.0 if reflex is None else (1.0 if blobs == 1 else 0.5)
    if refined is None:
        confidence *= 0.5
    return EyeMeasure(side, center, radius, reflex, offset, confidence)
