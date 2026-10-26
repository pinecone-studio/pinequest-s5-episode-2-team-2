import json

import pytest

from hirschberg.summarize import capture_of, main, summarize_captures, table, to_frame


def measured(name: str, ax: float) -> dict:
    eye = {"reflex_offset": {"x": 0.0, "y": 0.0}}
    return {"file": name, "eyes": [eye, eye], "asymmetry": {"x": ax, "y": 0.0}}


def test_capture_name_drops_the_frame_suffix():
    assert capture_of("P007_N_r1_ip13_20261024_f12.jpg") == "P007_N_r1_ip13_20261024"
    assert capture_of("photo.png") == "photo"


@pytest.mark.parametrize(
    ("line", "reasons", "eyes_found"),
    [
        ({"file": "a.jpg", "error": "NO_FACE"}, ["NO_FACE"], False),
        ({"file": "a.jpg", "error": "MULTIPLE_FACES"}, ["MULTIPLE_FACES"], False),
        ({"file": "a.jpg", "error": "UNREADABLE"}, ["EYE_NOT_FOUND"], False),
        (
            {"file": "a.jpg", "eyes": [{"reflex_offset": None}] * 2, "asymmetry": None},
            ["REFLEX_NOT_FOUND"],
            True,
        ),
    ],
)
def test_rejected_frames_carry_a_reason(line, reasons, eyes_found):
    frame = to_frame(line)
    assert not frame.ok
    assert frame.reasons == reasons
    assert frame.eyes_found == eyes_found


def test_summarizes_each_capture():
    lines = [
        measured("A_f0.jpg", 0.1),
        measured("A_f1.jpg", 0.3),
        measured("A_f2.jpg", 0.2),
        {"file": "A_f3.jpg", "error": "NO_FACE"},
        measured("B.jpg", 0.05),
    ]
    summaries = summarize_captures(lines)
    assert list(summaries) == ["A", "B"]
    a = summaries["A"]
    assert (a.frames_total, a.frames_used) == (4, 3)
    assert a.asymmetry_score == pytest.approx(0.2)
    assert a.spread == pytest.approx(0.1)
    assert a.quality_reasons == ["NO_FACE"]
    assert "| A | 3/4 | 0.200 | 0.100 | NO_FACE |" in table(summaries)
    assert "| B | 1/1 | 0.050 | 0.000 | - |" in table(summaries)


def test_cli(tmp_path, capsys):
    path = tmp_path / "results.jsonl"
    path.write_text(json.dumps(measured("A_f0.jpg", 0.1)) + "\n\n", "utf8")
    assert main([str(path)]) == 0
    assert "| A | 1/1 |" in capsys.readouterr().out
    empty = tmp_path / "empty.jsonl"
    empty.write_text("", "utf8")
    assert main([str(empty)]) == 1
