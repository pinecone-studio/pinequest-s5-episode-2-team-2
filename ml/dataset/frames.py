"""Extracts frames from capture videos for the measurement CLI (#8).

Usage: python -m dataset.frames <captures> <out> [--step 3] [--sheet sheet.csv]

Reads videos named as in docs/capture-protocol.md section 6 and writes every `--step`-th frame
as `<out>/<capture>_f<frame>.jpg`, the naming hirschberg.summarize, hirschberg.evaluate and
hirschberg.calibration expect. Files that break the naming scheme, or are marked
`usable = no` in the data sheet, are skipped and listed. <out> must be in the private Drive:
writing inside the repository is refused.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Iterator
from pathlib import Path

import cv2
import numpy as np

from dataset.prelabel import VIDEO_SUFFIXES, load_sheet, parse_name

REPO_ROOT = Path(__file__).resolve().parents[2]
JPEG_QUALITY = 95


def inside_repo(path: Path) -> bool:
    return path.resolve().is_relative_to(REPO_ROOT)


def every_nth_frame(path: Path, step: int) -> Iterator[tuple[int, np.ndarray]]:
    """(index, frame) for frames 0, step, 2·step, ... of a video."""
    video = cv2.VideoCapture(str(path))
    try:
        index = 0
        while True:
            ok, frame = video.read()
            if not ok:
                return
            if index % step == 0:
                yield index, frame
            index += 1
    finally:
        video.release()


def skip_reason(path: Path, sheet: dict[str, dict]) -> str | None:
    if parse_name(path.stem) is None:
        return "BAD_NAME"
    if sheet.get(path.stem, {}).get("usable") == "no":
        return "NOT_USABLE"
    return None


def extract(
    captures: Path,
    out: Path,
    step: int,
    sheet: dict[str, dict],
    max_frames: int | None = None,
) -> tuple[int, dict]:
    """Writes frames for every usable video; returns the frame count and skipped files.

    `max_frames` caps the frames taken from one video (the first ones), so a long recording
    does not outweigh the 3-second captures in the reports.
    """
    written, skipped = 0, {}
    videos = sorted(p for p in captures.iterdir() if p.suffix.lower() in VIDEO_SUFFIXES)
    for path in videos:
        reason = skip_reason(path, sheet)
        if reason:
            skipped[path.name] = reason
            continue
        count = 0
        for index, frame in every_nth_frame(path, step):
            if max_frames is not None and count >= max_frames:
                break
            target = out / f"{path.stem}_f{index}.jpg"
            cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            count += 1
        if count == 0:
            skipped[path.name] = "UNREADABLE"
        written += count
    return written, skipped


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("captures", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--step", type=int, default=3)
    parser.add_argument("--sheet", type=Path)
    parser.add_argument("--max-frames", type=int, help="at most this many frames per video")
    args = parser.parse_args(argv)
    if args.step < 1:
        parser.error("--step must be at least 1")
    if args.max_frames is not None and args.max_frames < 1:
        parser.error("--max-frames must be at least 1")
    if inside_repo(args.out):
        print(
            "Refusing to write frames inside the repository; use the private Drive.",
            file=sys.stderr,
        )
        return 2
    args.out.mkdir(parents=True, exist_ok=True)
    written, skipped = extract(
        args.captures, args.out, args.step, load_sheet(args.sheet), args.max_frames
    )
    print(f"Wrote {written} frames to {args.out}.")
    for name, reason in sorted(skipped.items()):
        print(f"Skipped {name}: {reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
