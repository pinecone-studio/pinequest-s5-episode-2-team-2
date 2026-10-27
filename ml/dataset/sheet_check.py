"""Checks the data sheet against the capture protocol (#29).

Usage: python -m dataset.sheet_check sheet.csv

Reads the data sheet exported as CSV (docs/data-dictionary.md) and prints problems: file
names that break the naming scheme or disagree with their row, missing consent, `D` scans of
children, and people still missing scans from protocol section 5. Only problem lines and
counts are printed, never names or private fields. Exits 1 when there are problems.
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path

from dataset.prelabel import parse_name

# Protocol section 5: scans each person should have.
NORMAL_REPEATS = 3
CALIBRATION = {"C00", "C25L", "C25R", "C05L", "C05R", "C10L", "C10R"}
DEVIATION_REPEATS = 2
ANGLE_CODES = {"0": "00", "2.5": "25", "5": "05", "10": "10"}


def row_problems(row: dict) -> list[str]:
    name = row.get("file_name", "").strip()
    meta = parse_name(Path(name).stem)
    if meta is None:
        return [f"{name or '(empty)'}: file name does not follow the protocol"]
    problems = []
    if not row.get("consent_id", "").strip():
        problems.append(f"{name}: no consent_id")
    if row.get("person_id", "").strip() != meta["person_id"]:
        problems.append(f"{name}: person_id does not match the file name")
    if row.get("scan_type", "").strip() != meta["scan_type"]:
        problems.append(f"{name}: scan_type does not match the file name")
    if meta["scan_type"] == "D" and row.get("age_group", "").strip() != "adult":
        problems.append(f"{name}: D scans are for adults only")
    if meta["scan_type"] == "C":
        angle = ANGLE_CODES.get(row.get("target_angle_deg", "").strip())
        if angle != meta["angle"]:
            problems.append(f"{name}: target_angle_deg does not match the file name")
        if (row.get("target_dir", "").strip() or None) != meta["dir"]:
            problems.append(f"{name}: target_dir does not match the file name")
    return problems


def usable_counts(rows: list[dict]) -> tuple[dict[str, dict[str, int]], set[str]]:
    """Usable captures per person and condition, and which people are adults."""
    seen: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    adults = set()
    for row in rows:
        meta = parse_name(Path(row.get("file_name", "")).stem)
        if meta is None or row.get("usable", "").strip() == "no":
            continue
        seen[meta["person_id"]][meta["condition"]] += 1
        if row.get("age_group", "").strip() == "adult":
            adults.add(meta["person_id"])
    return seen, adults


def coverage_table(rows: list[dict]) -> str:
    """One Markdown row per person: usable N, calibration targets and D captures, and done."""
    seen, adults = usable_counts(rows)
    lines = [
        "| Person | Adult | N | Calibration targets | D | Complete |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    done = 0
    for person, counts in sorted(seen.items()):
        targets = sum(1 for c in CALIBRATION if counts[c])
        adult = person in adults
        complete = (
            counts["N"] >= NORMAL_REPEATS
            and targets == len(CALIBRATION)
            and (not adult or counts["D"] >= DEVIATION_REPEATS)
        )
        done += complete
        d = f"{counts['D']}/{DEVIATION_REPEATS}" if adult else "-"
        lines.append(
            f"| {person} | {'yes' if adult else 'no'} | {counts['N']}/{NORMAL_REPEATS} | "
            f"{targets}/{len(CALIBRATION)} | {d} | {'yes' if complete else 'no'} |"
        )
    lines += ["", f"Complete: {done} of {len(seen)} people."]
    return "\n".join(lines)


def coverage_problems(rows: list[dict]) -> list[str]:
    """Scans each person still needs; only usable rows count."""
    seen, adults = usable_counts(rows)
    problems = []
    for person, counts in sorted(seen.items()):
        missing = []
        if counts["N"] < NORMAL_REPEATS:
            missing.append(f"N x{NORMAL_REPEATS - counts['N']}")
        missing += sorted(c for c in CALIBRATION if not counts[c])
        if person in adults and counts["D"] < DEVIATION_REPEATS:
            missing.append(f"D x{DEVIATION_REPEATS - counts['D']}")
        if missing:
            problems.append(f"{person}: missing {', '.join(missing)}")
    return problems


def check(rows: list[dict]) -> tuple[list[str], list[str]]:
    errors = [p for row in rows for p in row_problems(row)]
    names = [row.get("file_name", "").strip() for row in rows]
    errors += [
        f"{n}: listed more than once" for n in sorted({n for n in names if names.count(n) > 1})
    ]
    return errors, coverage_problems(rows)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("sheet", type=Path)
    args = parser.parse_args(argv)
    with args.sheet.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    errors, missing = check(rows)
    people = len({r.get("person_id", "") for r in rows})
    print(f"Rows: {len(rows)}, people: {people}.")
    print()
    print(coverage_table(rows))
    for title, items in (("Errors", errors), ("Missing scans", missing)):
        if items:
            print(f"\n{title}:")
            print("\n".join(f"- {item}" for item in items))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
