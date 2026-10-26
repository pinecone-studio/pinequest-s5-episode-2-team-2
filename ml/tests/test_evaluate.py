import json
import math

import pytest

from hirschberg.evaluate import (
    Capture,
    auc,
    best_threshold,
    bootstrap,
    candidate_thresholds,
    captures_from,
    device_table,
    main,
    operating_point,
    report,
)


def capture(person: str, deviated: bool, score: float, device: str = "ip13") -> Capture:
    kind = "D" if deviated else "N"
    return Capture(f"{person}_{kind}_r1_{device}_20261024", person, device, deviated, score, 10)


def separable() -> list[Capture]:
    """Normal captures score 0.02-0.06, deviated 0.30-0.40, across four people."""
    out = []
    for i, person in enumerate(["P001", "P002", "P003", "P004"]):
        out.append(capture(person, False, 0.02 + 0.01 * i))
        out.append(capture(person, True, 0.30 + 0.03 * i))
    return out


def frame_line(name: str, ax: float | None) -> dict:
    if ax is None:
        return {"file": name, "error": "NO_FACE"}
    eye = {"reflex_offset": {"x": 0.0, "y": 0.0}}
    return {"file": name, "eyes": [eye, eye], "asymmetry": {"x": ax, "y": 0.0}}


def test_operating_point_flags_scores_at_the_threshold():
    p = operating_point(separable(), 0.30)
    assert (p.true_positive, p.false_negative, p.true_negative, p.false_positive) == (4, 0, 4, 0)
    assert p.sensitivity == 1 and p.specificity == 1 and p.youden == 1
    high = operating_point(separable(), 0.35)
    assert high.true_positive == 2 and high.sensitivity == 0.5


def test_auc_counts_ties_as_half():
    assert auc(separable()) == 1
    tied = [capture("P1", True, 0.1), capture("P2", False, 0.1)]
    assert auc(tied) == 0.5
    assert auc([capture("P1", True, 0.1)]) is None


def test_best_threshold_prefers_fewer_false_referrals_on_ties():
    best = best_threshold(separable())
    # 0.30 is the only threshold with Youden 1 here.
    assert best.threshold == pytest.approx(0.30)
    overlap = [capture("P1", True, 0.2), capture("P2", False, 0.1), capture("P3", False, 0.3)]
    assert best_threshold(overlap).threshold == pytest.approx(0.2)


def test_candidate_thresholds_are_distinct_scores():
    assert candidate_thresholds([capture("A", True, 0.2), capture("B", False, 0.2)]) == [0.2]


def test_bootstrap_resamples_people_and_needs_two():
    lo, hi = bootstrap(separable(), auc, rounds=200)
    assert lo == hi == 1
    assert bootstrap([capture("P1", True, 0.1), capture("P1", False, 0.0)], auc) is None


def test_captures_from_cli_lines_skips_poor_and_unlabelled():
    lines = [frame_line(f"P001_N_r1_ip13_20261024_f{i}.jpg", 0.03) for i in range(6)]
    lines += [frame_line(f"P001_D_r1_ip13_20261024_f{i}.jpg", 0.4) for i in range(6)]
    lines += [frame_line(f"P002_D_r1_ip13_20261024_f{i}.jpg", None) for i in range(6)]
    lines += [frame_line(f"P001_C05L_r1_ip13_20261024_f{i}.jpg", 0.0) for i in range(6)]
    lines += [frame_line("IMG_0001.jpg", 0.1)]
    captures, too_poor = captures_from(lines, min_frames=5)
    assert sorted((c.name, c.deviated) for c in captures) == [
        ("P001_D_r1_ip13_20261024", True),
        ("P001_N_r1_ip13_20261024", False),
    ]
    assert too_poor == 1


def test_report_and_cli(tmp_path, capsys):
    text = report(separable(), too_poor=2)
    assert "8 captures from 4 people: 4 deviated (`D`), 4 normal (`N`). 2 left out" in text
    assert "AUC: 1.000" in text
    assert "Highest Youden index at threshold 0.300: sensitivity 1.000" in text
    assert "| 0.300 | 1.000 | 1.000 | 4 | 0 | 4 | 0 |" in text

    path = tmp_path / "results.jsonl"
    lines = [frame_line(f"P00{p}_{k}_r1_ip13_20261024_f{i}.jpg", s) for p in (1, 2)
             for k, s in (("N", 0.02 * p), ("D", 0.3 + 0.05 * p)) for i in range(5)]  # fmt: skip
    path.write_text("\n".join(json.dumps(x) for x in lines), "utf8")
    assert main([str(path)]) == 0
    assert "# Detection evaluation" in capsys.readouterr().out
    assert main([str(path), "--min-frames", "6"]) == 1


def test_missing_class_gives_nan_rates():
    only_normal = [capture("P1", False, 0.1)]
    assert math.isnan(operating_point(only_normal, 0.1).sensitivity)
    assert best_threshold(only_normal) is None


def test_device_table_only_with_several_devices():
    assert device_table(separable()) == []
    mixed = separable() + [capture("P9", True, 0.01, "ip15"), capture("P9", False, 0.2, "ip15")]
    rows = device_table(mixed)
    assert "| ip13 | 8 | 4 | 1.000 |" in rows
    assert "| ip15 | 2 | 1 | 0.000 |" in rows
    assert "| Device | Captures | People | AUC |" in report(mixed, too_poor=0)
