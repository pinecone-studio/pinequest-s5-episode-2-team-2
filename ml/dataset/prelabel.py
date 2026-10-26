"""Cuts eye crops from captures and pre-labels them with the heuristic for Label Studio.

Usage: python -m dataset.prelabel <captures> <out> [--sheet sheet.csv] [--frames 3]

<captures> holds videos or images named as in docs/capture-protocol.md section 6. For every
sampled frame and eye it writes a crop to <out>/crops/ and one Label Studio task, with the
heuristic keypoints as predictions, to <out>/tasks.json. <out> must be in the private Drive,
never in the repo.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

from hirschberg.cli import iris_estimates
from hirschberg.measure import EyeMeasure, EyeSide, measure_eye

FILE_NAME = re.compile(
    r"^(?P<person_id>P\d+)_(?P<scan_type>[NCD])(?P<angle>\d{2})?(?P<dir>[LR])?"
    r"_r(?P<repeat>\d+)_(?P<device>[a-z0-9]+)_(?P<date>\d{8})$"
)
VIDEO_SUFFIXES = {".mov", ".mp4"}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
# Crop side in iris radii: the iris fills 40% of the crop, with lids and some skin around it.
CROP_SCALE = 5.0
# Label Studio point size, in percent of the crop.
POINT_SIZE = 0.8


def parse_name(stem: str) -> dict | None:
    """Capture metadata from a protocol file name, or None if it does not follow it."""
    match = FILE_NAME.match(stem)
    if not match:
        return None
    meta = match.groupdict()
    meta["condition"] = meta["scan_type"] + (meta["angle"] or "") + (meta["dir"] or "")
    meta["repeat"] = int(meta["repeat"])
    return meta


def read_frames(path: Path, count: int) -> list[tuple[int, np.ndarray]]:
    """The image itself, or `count` frames spread over the middle of a video."""
    if path.suffix.lower() in IMAGE_SUFFIXES:
        image = cv2.imread(str(path))
        return [] if image is None else [(0, image)]
    video = cv2.VideoCapture(str(path))
    total = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    frames = []
    for index in np.linspace(total * 0.2, total * 0.8, count).astype(int):
        video.set(cv2.CAP_PROP_POS_FRAMES, int(index))
        ok, frame = video.read()
        if ok:
            frames.append((int(index), frame))
    video.release()
    return frames


def crop_eye(image: np.ndarray, cx: float, cy: float, radius: float) -> tuple[np.ndarray, int, int]:
    """Square crop centred on the iris; edges are replicated where it leaves the frame.

    Returns the crop and the frame coordinates of its top-left corner.
    """
    side = int(round(CROP_SCALE * radius))
    x0, y0 = int(round(cx)) - side // 2, int(round(cy)) - side // 2
    padded = cv2.copyMakeBorder(image, side, side, side, side, cv2.BORDER_REPLICATE)
    return padded[y0 + side : y0 + 2 * side, x0 + side : x0 + 2 * side].copy(), x0, y0


def keypoint(label: str, x: float, y: float, width: int, height: int) -> dict:
    return {
        "type": "keypointlabels",
        "from_name": "kp",
        "to_name": "image",
        "original_width": width,
        "original_height": height,
        "image_rotation": 0,
        "value": {
            "x": 100 * x / width,
            "y": 100 * y / height,
            "width": POINT_SIZE,
            "keypointlabels": [label],
        },
    }


def make_task(image_url: str, size: int, eye: EyeMeasure, x0: int, y0: int, data: dict) -> dict:
    """One Label Studio task; heuristic points are moved from frame to crop coordinates."""
    cx, cy = eye.iris_center.x - x0, eye.iris_center.y - y0
    result = [
        keypoint("iris_center", cx, cy, size, size),
        keypoint("iris_edge", cx + eye.iris_radius, cy, size, size),
    ]
    if eye.reflex is not None:
        result.append(keypoint("reflex", eye.reflex.x - x0, eye.reflex.y - y0, size, size))
    return {
        "data": {"image": image_url, **data},
        "predictions": [{"model_version": "hirschberg", "result": result}],
    }


def load_sheet(path: Path | None) -> dict[str, dict]:
    """Data sheet rows (docs/data-dictionary.md) by file name, from a CSV export."""
    if path is None:
        return {}
    with open(path, newline="") as f:
        return {Path(row["file_name"]).stem: row for row in csv.DictReader(f)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("captures", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--sheet", type=Path, help="data sheet CSV, adds distance_cm")
    parser.add_argument("--frames", type=int, default=3, help="frames per video")
    parser.add_argument("--model", type=Path, default=Path("models/face_landmarker.task"))
    parser.add_argument("--image-url", default="/data/local-files/?d=crops/")
    args = parser.parse_args(argv)
    if not args.model.is_file():
        print(f"Model not found: {args.model} (see ml/README.md)", file=sys.stderr)
        return 2

    sheet = load_sheet(args.sheet)
    (args.out / "crops").mkdir(parents=True, exist_ok=True)
    tasks, skipped = [], {}
    files = sorted(
        p for p in args.captures.iterdir() if p.suffix.lower() in VIDEO_SUFFIXES | IMAGE_SUFFIXES
    )
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(args.model)), num_faces=2
    )
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        for path in files:
            meta, row = parse_name(path.stem), sheet.get(path.stem, {})
            reason = (
                "BAD_NAME" if meta is None else "NOT_USABLE" if row.get("usable") == "no" else None
            )
            if reason:
                skipped[path.name] = reason
                continue
            for frame_index, bgr in read_frames(path, args.frames):
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                faces = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
                if len(faces.face_landmarks) != 1:
                    skipped[f"{path.name}#{frame_index}"] = "NO_SINGLE_FACE"
                    continue
                height, width = bgr.shape[:2]
                gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
                sides: tuple[EyeSide, EyeSide] = ("imageLeft", "imageRight")
                irises = iris_estimates(faces.face_landmarks[0], width, height)
                for side, (center, radius) in zip(sides, irises, strict=True):
                    eye = measure_eye(gray, side, center, radius)
                    crop, x0, y0 = crop_eye(
                        bgr, eye.iris_center.x, eye.iris_center.y, eye.iris_radius
                    )
                    name = f"{path.stem}_f{frame_index:03d}_{side}.png"
                    cv2.imwrite(str(args.out / "crops" / name), crop)
                    data = {
                        "crop": f"crops/{name}",
                        "source": path.name,
                        "frame": frame_index,
                        "side": side,
                        "distance_cm": row.get("distance_cm") or None,
                        **meta,
                    }
                    tasks.append(make_task(args.image_url + name, crop.shape[0], eye, x0, y0, data))

    (args.out / "tasks.json").write_text(json.dumps(tasks, indent=1))
    print(f"{len(tasks)} tasks from {len(files)} files, {len(skipped)} skipped", file=sys.stderr)
    for name, reason in skipped.items():
        print(f"  skipped {name}: {reason}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
