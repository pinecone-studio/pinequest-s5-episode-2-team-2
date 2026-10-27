"""Per-frame quality checks.

Reference for packages/core/src/quality.ts and pixels.ts: the same inputs give the same
reasons and values (packages/core/fixtures/quality.json is checked by both test suites).
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from hirschberg.measure import Point

# Face Landmarker indices: eye corners and lids for both eyes, cheek edges, nose tip, chin.
EYES = (((33, 133), (159, 145)), ((263, 362), (386, 374)))
CHEEKS = (234, 454)
IRIS_CENTERS = (468, 473)
NOSE_TIP = 1
CHIN = 152
# TODO(tune): nose tip height between the eye line and the chin on a level, frontal face.
FRONTAL_NOSE_RATIO = 0.45
# Luminance at or above this counts as clipped (about 250 of 255).
CLIP_LEVEL = 0.98


@dataclass(frozen=True)
class QualityConfig:
    min_eye_open: float = 0.15
    max_roll_deg: float = 10
    max_yaw_deg: float = 15
    max_pitch_deg: float = 20
    min_iris_fraction: float = 0.008
    max_iris_fraction: float = 0.02
    min_sharpness: float = 0.0005
    min_exposure: float = 0.15
    max_exposure: float = 0.85
    max_clipped: float = 0.1
    max_gaze_shift: float = 0.03


DEFAULT_QUALITY_CONFIG = QualityConfig()


@dataclass(frozen=True)
class HeadPose:
    yaw: float
    pitch: float
    roll: float


@dataclass(frozen=True)
class CropStats:
    sharpness: float
    exposure: float
    clipped: float


@dataclass(frozen=True)
class FrameQuality:
    ok: bool
    reasons: list[str]
    sharpness: float | None
    exposure: float | None
    head_pose: HeadPose | None


def crop_stats(luma: np.ndarray) -> CropStats | None:
    """Laplacian variance over interior pixels, mean and clipped fraction of a 0..1 crop."""
    luma = np.asarray(luma, dtype=np.float64)
    if luma.ndim != 2 or min(luma.shape) < 3 or not np.isfinite(luma).all():
        return None
    lap = luma[1:-1, :-2] + luma[1:-1, 2:] + luma[:-2, 1:-1] + luma[2:, 1:-1] - 4 * luma[1:-1, 1:-1]
    return CropStats(
        sharpness=float(max(0.0, lap.var())),
        exposure=float(luma.mean()),
        clipped=float((luma >= CLIP_LEVEL).mean()),
    )


def _dist(a: Point, b: Point) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def _clamp(v: float) -> float:
    return max(-1.0, min(1.0, v))


def eye_openness(lm: Sequence[Point]) -> tuple[float, float]:
    """Lid gap over eye width for both eyes."""
    values = []
    for corners, lids in EYES:
        width = _dist(lm[corners[0]], lm[corners[1]])
        values.append(_dist(lm[lids[0]], lm[lids[1]]) / width if width > 0 else 0.0)
    return values[0], values[1]


def gaze_shift(lm: Sequence[Point]) -> tuple[float, float]:
    """Horizontal iris position in each eye over the eye width; see gazeShift in quality.ts."""
    eyes = []
    for corners, _ in EYES:
        a, b = lm[corners[0]], lm[corners[1]]
        eyes.append((Point((a.x + b.x) / 2, (a.y + b.y) / 2), _dist(a, b)))
    eyes.sort(key=lambda e: e[0].x)
    irises = [lm[i] for i in IRIS_CENTERS]
    shifts = []
    for mid, width in eyes:
        iris = min(irises, key=lambda p: _dist(p, mid))
        shifts.append((iris.x - mid.x) / width if width > 0 else 0.0)
    return shifts[0], shifts[1]


def looking_away(lm: Sequence[Point], max_shift: float) -> bool:
    """True when both irises sit off-centre to the same side: a sideways look, not a squint."""
    a, b = gaze_shift(lm)
    return math.copysign(1, a) == math.copysign(1, b) and min(abs(a), abs(b)) > max_shift


def head_pose(lm: Sequence[Point]) -> HeadPose:
    """Rough yaw, pitch and roll in degrees from 2D landmarks; see headPose in quality.ts."""
    p, q = sorted((lm[EYES[0][0][0]], lm[EYES[1][0][0]]), key=lambda u: u.x)
    roll = math.degrees(math.atan2(q.y - p.y, q.x - p.x))

    nose = lm[NOSE_TIP]
    left, right = sorted((lm[CHEEKS[0]], lm[CHEEKS[1]]), key=lambda u: u.x)
    across = right.x - left.x
    yaw = (
        math.degrees(math.asin(_clamp(((nose.x - left.x) / across - 0.5) * 2))) if across > 0 else 0
    )

    eye_y = sum(lm[i].y for corners, _ in EYES for i in corners) / 4
    down = lm[CHIN].y - eye_y
    ratio = (nose.y - eye_y) / down if down > 0 else FRONTAL_NOSE_RATIO
    pitch = math.degrees(math.asin(_clamp((ratio - FRONTAL_NOSE_RATIO) / FRONTAL_NOSE_RATIO)))
    return HeadPose(yaw=yaw, pitch=pitch, roll=roll)


def assess_quality(
    frame_size: tuple[int, int],
    face_count: int,
    landmarks: Sequence[Point],
    iris_radii: tuple[float, float] | None,
    reflex_found: tuple[bool, bool] | None,
    crops: tuple[CropStats, CropStats] | None = None,
    config: QualityConfig = DEFAULT_QUALITY_CONFIG,
) -> FrameQuality:
    """Quality reasons for one frame, in the same order as assessQuality in quality.ts.

    iris_radii and reflex_found are None when the eyes were not measured.
    """

    def result(reasons: list[str], pose: HeadPose | None) -> FrameQuality:
        measured = crops is not None and pose is not None
        return FrameQuality(
            ok=not reasons,
            reasons=reasons,
            sharpness=min(c.sharpness for c in crops) if measured else None,
            exposure=sum(c.exposure for c in crops) / 2 if measured else None,
            head_pose=pose,
        )

    if face_count == 0:
        return result(["NO_FACE"], None)
    if face_count > 1:
        return result(["MULTIPLE_FACES"], None)
    if len(landmarks) != 478 or not all(
        math.isfinite(p.x) and math.isfinite(p.y) for p in landmarks
    ):
        return result(["EYE_NOT_FOUND"], None)

    reasons: list[str] = []
    pose = head_pose(landmarks)
    if (
        abs(pose.roll) > config.max_roll_deg
        or abs(pose.yaw) > config.max_yaw_deg
        or abs(pose.pitch) > config.max_pitch_deg
    ):
        reasons.append("HEAD_TURNED")
    if any(o < config.min_eye_open for o in eye_openness(landmarks)):
        reasons.append("EYES_CLOSED")
    if looking_away(landmarks, config.max_gaze_shift):
        reasons.append("NOT_LOOKING")

    if iris_radii is None or reflex_found is None:
        reasons.append("EYE_NOT_FOUND")
        return result(reasons, pose)
    iris = sum(iris_radii) / 2 / max(frame_size)
    if iris < config.min_iris_fraction:
        reasons.append("TOO_FAR")
    if iris > config.max_iris_fraction:
        reasons.append("TOO_CLOSE")
    if crops is not None:
        if any(c.sharpness < config.min_sharpness for c in crops):
            reasons.append("BLUR")
        if any(c.exposure < config.min_exposure for c in crops):
            reasons.append("TOO_DARK")
        elif any(c.exposure > config.max_exposure or c.clipped > config.max_clipped for c in crops):
            reasons.append("OVEREXPOSED")
    if not all(reflex_found):
        reasons.append("REFLEX_NOT_FOUND")
    return result(reasons, pose)
