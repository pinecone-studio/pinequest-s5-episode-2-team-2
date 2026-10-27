"""Synthetic eye images with a known reflex position, for bench-testing the measurement (#8).

A rendered eye has a light sclera inside an almond-shaped lid opening, a dark iris (slightly
narrowed horizontally when the eye turns), a darker pupil and a small bright corneal reflex.
Everything is drawn at 4x and averaged down, so edges are anti-aliased and positions are
sub-pixel. The ground truth is returned with the image, so the measurement error is known
exactly. These are not photographs: they test the algorithm, not the eye.

The reflex offset for a gaze angle follows the Hirschberg relation: a rotation of D prism
dioptres moves the reflex by D / HR mm relative to the iris centre, with HR = 19.9 prism
dioptres per mm in children (Hasebe et al., IOVS 1998;39:2782-5), and the offset is that
distance over the iris radius, 11.71 / 2 mm (Rüfer et al., Cornea 2005;24:259-61).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import cv2
import numpy as np

from hirschberg.measure import Point

HIRSCHBERG_RATIO = 19.9  # prism dioptres per mm, children (Hasebe et al. 1998)
IRIS_RADIUS_MM = 11.71 / 2  # mean visible iris diameter (Rüfer et al. 2005)
SUPERSAMPLE = 4

# Grey levels on 0..255; a torch-lit eye at the capture distance.
SKIN, SCLERA, IRIS, PUPIL, REFLEX = 150, 205, 75, 25, 255


def prism_dioptres(angle_deg: float) -> float:
    return 100 * math.tan(math.radians(angle_deg))


def offset_for_angle(angle_deg: float) -> float:
    """Horizontal reflex offset in iris radii for a gaze rotation of `angle_deg`."""
    return prism_dioptres(angle_deg) / HIRSCHBERG_RATIO / IRIS_RADIUS_MM


@dataclass(frozen=True)
class EyeScene:
    """What to draw. Distances are in output pixels."""

    iris_radius: float = 40.0
    angle_deg: float = 0.0
    """Horizontal gaze rotation; positive moves the reflex to image right."""
    kappa: float = 0.0
    """Reflex offset of a straight eye in iris radii (angle kappa), added to the rotation."""
    reflex_radius: float = 0.07
    """Reflex spot radius in iris radii."""
    lid_opening: float = 1.05
    """Half-height of the lid opening in iris radii; below 1 the lids cover part of the iris."""
    window: tuple[float, float, float] | None = None
    """A second reflection (window, lamp): x and y from the iris centre and radius, all in
    iris radii. None for only the torch reflex."""
    center_jitter: tuple[float, float] = (0.0, 0.0)
    """Sub-pixel shift of the iris centre from the image centre."""
    blur_sigma: float = 0.0
    noise_sigma: float = 0.0
    brightness: float = 1.0
    """Multiplies every grey level before noise; below 1 is darker."""


@dataclass(frozen=True)
class SyntheticEye:
    image: np.ndarray
    iris_center: Point
    iris_radius: float
    reflex: Point
    reflex_offset: Point


def render_eye(scene: EyeScene, rng: np.random.Generator | None = None) -> SyntheticEye:
    """Draws one eye; noise needs `rng`, so the same seed gives the same image."""
    r = scene.iris_radius
    size = int(math.ceil(r * 6)) | 1  # odd, so the image has a centre pixel
    s = SUPERSAMPLE
    cx = size / 2 + scene.center_jitter[0]
    cy = size / 2 + scene.center_jitter[1]
    offset_x = offset_for_angle(scene.angle_deg) + scene.kappa
    reflex = Point(cx + offset_x * r, cy)

    def px(v: float) -> int:
        return int(round(v * s))

    big = np.full((size * s, size * s), SKIN, np.float32)
    # Lid opening: an ellipse wider than the iris that hides its top and bottom edges a little.
    lid_h = px(scene.lid_opening * r)
    cv2.ellipse(big, (px(cx), px(cy)), (px(2.6 * r), lid_h), 0, 0, 360, SCLERA, -1)
    # Turning the eye narrows the iris horizontally by cos(angle).
    squash = math.cos(math.radians(scene.angle_deg))
    iris = np.zeros_like(big)
    cv2.ellipse(iris, (px(cx), px(cy)), (px(r * squash), px(r)), 0, 0, 360, 1, -1)
    lid = np.zeros_like(big)
    cv2.ellipse(lid, (px(cx), px(cy)), (px(2.6 * r), lid_h), 0, 0, 360, 1, -1)
    big[(iris > 0) & (lid > 0)] = IRIS
    pupil = np.zeros_like(big)
    cv2.ellipse(pupil, (px(cx), px(cy)), (px(0.4 * r * squash), px(0.4 * r)), 0, 0, 360, 1, -1)
    big[(pupil > 0) & (lid > 0)] = PUPIL
    spot = np.zeros_like(big)
    cv2.circle(spot, (px(reflex.x), px(reflex.y)), max(1, px(scene.reflex_radius * r)), 1, -1)
    if scene.window is not None:
        wx, wy, wr = scene.window
        cv2.circle(spot, (px(cx + wx * r), px(cy + wy * r)), max(1, px(wr * r)), 1, -1)
    big[(spot > 0) & (lid > 0)] = REFLEX

    image = cv2.resize(big, (size, size), interpolation=cv2.INTER_AREA)
    if scene.blur_sigma > 0:
        image = cv2.GaussianBlur(image, (0, 0), scene.blur_sigma)
    image = image * scene.brightness
    if scene.noise_sigma > 0:
        if rng is None:
            raise ValueError("noise needs an rng")
        image = image + rng.normal(0, scene.noise_sigma, image.shape)
    return SyntheticEye(
        image=np.clip(np.round(image), 0, 255).astype(np.uint8),
        iris_center=Point(cx, cy),
        iris_radius=r,
        reflex=reflex,
        reflex_offset=Point(offset_x, 0.0),
    )
