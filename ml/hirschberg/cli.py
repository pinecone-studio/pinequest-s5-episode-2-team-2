"""Measures every image in a folder and prints one JSON line per image.

Usage: python -m hirschberg.cli <folder> [--model models/face_landmarker.task]
Images are only read; nothing is written or uploaded.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import asdict
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

from hirschberg.measure import EyeMeasure, EyeSide, Point, measure_eye, mirrored_asymmetry
from hirschberg.quality import CropStats, FrameQuality, assess_quality, crop_stats

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
# Face Landmarker iris landmarks: centre followed by four boundary points.
IRIS_LANDMARKS = ((468, 469, 470, 471, 472), (473, 474, 475, 476, 477))
# The app's eye crop: a square of 5 iris radii, resized to the model input (eyeRegions).
CROP_RADII = 5.0
CROP_SIZE = 128


def iris_estimates(landmarks, width: int, height: int) -> list[tuple[Point, float]]:
    irises = []
    for center_idx, *edge_idx in IRIS_LANDMARKS:
        c = landmarks[center_idx]
        center = Point(c.x * width, c.y * height)
        radius = sum(
            math.hypot(landmarks[i].x * width - center.x, landmarks[i].y * height - center.y)
            for i in edge_idx
        ) / len(edge_idx)
        irises.append((center, radius))
    return sorted(irises, key=lambda iris: iris[0].x)


def eye_crop_stats(gray: np.ndarray, center: Point, radius: float) -> CropStats | None:
    """Sharpness and exposure of the crop the app takes around one iris."""
    side = int(round(CROP_RADII * radius))
    if side < 3:
        return None
    x0, y0 = int(round(center.x)) - side // 2, int(round(center.y)) - side // 2
    padded = cv2.copyMakeBorder(gray, side, side, side, side, cv2.BORDER_REPLICATE)
    crop = padded[y0 + side : y0 + 2 * side, x0 + side : x0 + 2 * side]
    crop = cv2.resize(crop, (CROP_SIZE, CROP_SIZE), interpolation=cv2.INTER_AREA)
    return crop_stats(crop / 255.0)


def frame_quality(gray: np.ndarray, landmarks: list[Point], eyes: list[EyeMeasure]) -> FrameQuality:
    height, width = gray.shape[:2]
    stats = [eye_crop_stats(gray, e.iris_center, e.iris_radius) for e in eyes]
    crops = None if any(s is None for s in stats) else (stats[0], stats[1])
    return assess_quality(
        frame_size=(width, height),
        face_count=1,
        landmarks=landmarks,
        iris_radii=(eyes[0].iris_radius, eyes[1].iris_radius),
        reflex_found=(eyes[0].reflex_offset is not None, eyes[1].reflex_offset is not None),
        crops=crops,
        reflex_counts=(eyes[0].reflex_count, eyes[1].reflex_count),
    )


def measure_image(path: Path, landmarker: vision.FaceLandmarker) -> dict:
    bgr = cv2.imread(str(path))
    if bgr is None:
        return {"file": path.name, "error": "UNREADABLE"}
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    result = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not result.face_landmarks:
        return {"file": path.name, "error": "NO_FACE"}
    if len(result.face_landmarks) > 1:
        return {"file": path.name, "error": "MULTIPLE_FACES"}

    height, width = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    sides: tuple[EyeSide, EyeSide] = ("imageLeft", "imageRight")
    eyes = [
        measure_eye(gray, side, center, radius)
        for side, (center, radius) in zip(
            sides, iris_estimates(result.face_landmarks[0], width, height), strict=True
        )
    ]
    left, right = eyes
    asymmetry = None
    if left.reflex_offset and right.reflex_offset:
        asymmetry = asdict(mirrored_asymmetry(left.reflex_offset, right.reflex_offset))
    landmarks = [Point(p.x * width, p.y * height) for p in result.face_landmarks[0]]
    quality = asdict(frame_quality(gray, landmarks, eyes))
    return {
        "file": path.name,
        "eyes": [asdict(e) for e in eyes],
        "asymmetry": asymmetry,
        "quality": quality,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("folder", type=Path)
    parser.add_argument("--model", type=Path, default=Path("models/face_landmarker.task"))
    args = parser.parse_args(argv)

    if not args.model.is_file():
        print(f"Model not found: {args.model} (see ml/README.md)", file=sys.stderr)
        return 2
    images = sorted(p for p in args.folder.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(args.model)), num_faces=2
    )
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        for path in images:
            print(json.dumps(measure_image(path, landmarker)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
