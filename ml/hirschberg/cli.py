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
from mediapipe.tasks.python import BaseOptions, vision

from hirschberg.measure import EyeSide, Point, measure_eye, mirrored_asymmetry

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
# Face Landmarker iris landmarks: centre followed by four boundary points.
IRIS_LANDMARKS = ((468, 469, 470, 471, 472), (473, 474, 475, 476, 477))


def _iris_estimates(landmarks, width: int, height: int) -> list[tuple[Point, float]]:
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
            sides, _iris_estimates(result.face_landmarks[0], width, height), strict=True
        )
    ]
    left, right = eyes
    asymmetry = None
    if left.reflex_offset and right.reflex_offset:
        asymmetry = asdict(mirrored_asymmetry(left.reflex_offset, right.reflex_offset))
    return {"file": path.name, "eyes": [asdict(e) for e in eyes], "asymmetry": asymmetry}


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
