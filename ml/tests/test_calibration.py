import json
import math

import numpy as np
import pytest

from hirschberg.calibration import (
    IRIS_RADIUS_MM,
    capture_key,
    fit_slope,
    frame_values,
    group_captures,
    hirschberg_ratio,
    main,
    per_person_ratios,
    repeatability_sd,
    report,
    wilson_ci,
)

SLOPE = 0.02
CODES = [("00", ""), ("25", "L"), ("25", "R"), ("05", "L"), ("05", "R"), ("10", "L"), ("10", "R")]


def line(name: str, shift: float | None, asym: float = 0.01) -> dict:
    if shift is None:
        return {"file": name, "error": "NO_FACE"}
    eye = {"reflex_offset": {"x": shift, "y": 0.0}}
    return {"file": name, "eyes": [eye, eye], "asymmetry": {"x": asym, "y": 0.0}}


def synthetic(noise: float = 0.002, seed: int = 1) -> list[dict]:
    rng = np.random.default_rng(seed)
    lines = []
    for person in ("P001", "P002", "P003"):
        for code, side in CODES:
            angle = {"00": 0, "25": 2.5, "05": 5, "10": 10}[code] * (-1 if side == "L" else 1)
            for repeat in (1, 2):
                stem = f"{person}_C{code}{side}_r{repeat}_ip13_20261024"
                offset = SLOPE * angle + rng.normal(0, noise)
                lines += [line(f"{stem}_f{i}.jpg", offset) for i in range(3)]
                lines.append(line(f"{stem}_f3.jpg", None))
    return lines


def test_capture_key_reads_signed_angles():
    assert capture_key("P007_C05L_r1_ip13_20261024_f12.jpg") == {
        "person": "P007",
        "angle_deg": -5.0,
        "repeat": 1,
        "device": "ip13",
    }
    assert capture_key("P007_C25R_r2_ip13_20261024.png")["angle_deg"] == 2.5
    assert capture_key("P007_C00_r1_ip13_20261024.jpg")["angle_deg"] == 0


@pytest.mark.parametrize(
    "name",
    ["P007_N_r1_ip13_20261024.jpg", "P007_C05_r1_ip13_20261024.jpg", "P007_C00L_r1_x_20261024.jpg"],
)
def test_capture_key_ignores_other_files(name):
    assert capture_key(name) is None


def test_groups_frames_into_captures():
    captures = group_captures(synthetic(noise=0))
    assert len(captures) == 3 * 7 * 2
    assert all(c.frames == 4 and c.failed == 1 for c in captures)
    left10 = next(c for c in captures if c.angle_deg == -10)
    assert left10.shift == pytest.approx(-0.2)
    assert left10.asymmetry == pytest.approx(0.01)


def test_recovers_slope_and_repeatability():
    captures = group_captures(synthetic(noise=0.002))
    slope, intercept = fit_slope(captures)
    assert slope == pytest.approx(SLOPE, abs=0.001)
    assert intercept == pytest.approx(0, abs=0.002)
    assert repeatability_sd(captures) == pytest.approx(0.002, rel=0.5)


def test_slope_needs_two_angles():
    captures = [c for c in group_captures(synthetic()) if c.angle_deg == 0]
    assert fit_slope(captures) is None


def test_wilson_interval():
    assert wilson_ci(0, 0) is None
    lo, hi = wilson_ci(1, 4)
    assert lo < 0.25 < hi
    assert wilson_ci(0, 10)[0] == 0


def test_report_and_cli(tmp_path, capsys):
    text = report(group_captures(synthetic()))
    assert "| Shift per degree (iris radii) | 0.0200 |" in text
    assert "| Frame failure rate | 0.250 (42/168) |" in text
    assert "| -10 deg | 6 | 0.010 |" in text

    path = tmp_path / "results.jsonl"
    path.write_text("\n".join(json.dumps(x) for x in synthetic()) + "\n", "utf8")
    assert main([str(path)]) == 0
    assert "# Calibration report" in capsys.readouterr().out

    empty = tmp_path / "empty.jsonl"
    empty.write_text(json.dumps(line("other.jpg", 0.1)) + "\n", "utf8")
    assert main([str(empty)]) == 1


def test_frames_rejected_by_quality_are_not_measured():
    good = line("P001_C00_r1_ip13_20261024_f0.jpg", 0.1)
    assert frame_values(good) == pytest.approx((0.1, 0.01))
    assert frame_values({**good, "quality": {"ok": True, "reasons": []}}) is not None
    assert frame_values({**good, "quality": {"ok": False, "reasons": ["BLUR"]}}) is None
    blurred = [{**good, "quality": {"ok": False, "reasons": ["BLUR"]}}, good]
    [capture] = group_captures(blurred)
    assert (capture.frames, capture.failed) == (2, 1)


def test_report_is_ascii_so_it_prints_on_any_console():
    report(group_captures(synthetic())).encode("ascii")


def test_hirschberg_ratio_from_the_slope():
    # A ratio of 19.9 PD/mm means 1.7455 / 19.9 mm per degree.
    slope = 100 * math.tan(math.radians(1)) / 19.9 / IRIS_RADIUS_MM
    assert hirschberg_ratio(slope) == pytest.approx(19.9)
    assert hirschberg_ratio(-slope) == pytest.approx(19.9)
    assert hirschberg_ratio(None) is None and hirschberg_ratio(0) is None


def test_per_person_ratios_in_the_report():
    ratios = per_person_ratios(group_captures(synthetic(noise=0)))
    expected = hirschberg_ratio(SLOPE)
    assert list(ratios) == ["P001", "P002", "P003"]
    assert all(r == pytest.approx(expected) for r in ratios.values())
    text = report(group_captures(synthetic(noise=0)))
    assert f"| P001 | {expected:.1f} |" in text
    assert "published for children 19.9 +/- 1.9" in text
