"""Summarizes hirschberg.cli results per capture, like the app does per scan.

Usage: python -m hirschberg.summarize results.jsonl [results2.jsonl ...]

Frames named `<capture>_f<frame>.<ext>` are grouped by `<capture>`; other images are their
own capture. Prints one Markdown row per capture with the frames used, the median asymmetry
and the spread. Frames rejected by the CLI's `quality` are dropped with their reasons; older
output without `quality` counts a frame as usable when both eyes have a reflex.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from collections.abc import Iterable
from pathlib import Path

from hirschberg.aggregate import Frame, ScanSummary, summarize_frames
from hirschberg.measure import Point

FRAME_SUFFIX = re.compile(r"_f\d+$")
# CLI errors that match a QualityReason in packages/core.
ERROR_REASONS = {"NO_FACE": "NO_FACE", "MULTIPLE_FACES": "MULTIPLE_FACES"}


def capture_of(file_name: str) -> str:
    return FRAME_SUFFIX.sub("", Path(file_name).stem)


def to_frame(line: dict) -> Frame:
    error = line.get("error")
    if error:
        return Frame(
            ok=False,
            reasons=[ERROR_REASONS.get(error, "EYE_NOT_FOUND")],
            eyes_found=False,
            asymmetry=None,
        )
    eyes = line.get("eyes") or []
    if len(eyes) != 2:
        return Frame(ok=False, reasons=["EYE_NOT_FOUND"], eyes_found=False, asymmetry=None)
    a = line.get("asymmetry")
    asymmetry = Point(a["x"], a["y"]) if a else None
    quality = line.get("quality")
    if quality is not None:
        # Output with quality: use the app's checks as they are.
        return Frame(
            ok=bool(quality["ok"]),
            reasons=list(quality["reasons"]),
            eyes_found=True,
            asymmetry=asymmetry,
        )
    if asymmetry is None or any(e.get("reflex_offset") is None for e in eyes):
        return Frame(ok=False, reasons=["REFLEX_NOT_FOUND"], eyes_found=True, asymmetry=None)
    return Frame(ok=True, reasons=[], eyes_found=True, asymmetry=asymmetry)


def summarize_captures(lines: Iterable[dict]) -> dict[str, ScanSummary]:
    frames: dict[str, list[Frame]] = defaultdict(list)
    for line in lines:
        if "file" in line:
            frames[capture_of(line["file"])].append(to_frame(line))
    return {capture: summarize_frames(f) for capture, f in sorted(frames.items())}


def _fmt(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.3f}"


def table(summaries: dict[str, ScanSummary]) -> str:
    rows = [
        "| Capture | Frames used | Asymmetry | Spread | Rejected for |",
        "| --- | --- | --- | --- | --- |",
    ]
    for capture, s in summaries.items():
        rows.append(
            f"| {capture} | {s.frames_used}/{s.frames_total} | {_fmt(s.asymmetry_score)} | "
            f"{_fmt(s.spread)} | {', '.join(s.quality_reasons) or '-'} |"
        )
    return "\n".join(rows)


def as_json_lines(summaries: dict[str, ScanSummary]) -> str:
    """One JSON object per capture, with the same field names as the app's ScanSummary."""
    return "\n".join(
        json.dumps(
            {
                "capture": capture,
                "framesTotal": s.frames_total,
                "framesUsed": s.frames_used,
                "asymmetryScore": s.asymmetry_score,
                "spread": s.spread,
                "qualityReasons": s.quality_reasons,
            }
        )
        for capture, s in summaries.items()
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("results", type=Path, nargs="+")
    parser.add_argument("--json", action="store_true", help="print JSON lines instead of Markdown")
    args = parser.parse_args(argv)
    lines = [
        json.loads(text)
        for path in args.results
        for text in path.read_text("utf8").splitlines()
        if text.strip()
    ]
    summaries = summarize_captures(lines)
    if not summaries:
        print("No results found.", file=sys.stderr)
        return 1
    print(as_json_lines(summaries) if args.json else table(summaries))
    return 0


if __name__ == "__main__":
    sys.exit(main())
