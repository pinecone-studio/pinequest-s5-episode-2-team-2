import json
import math
from pathlib import Path

import pytest

from hirschberg.aggregate import Frame, summarize_frames
from hirschberg.measure import Point

FIXTURES = json.loads(
    (Path(__file__).parents[2] / "packages/core/fixtures/aggregate.json").read_text("utf8")
)


def frame(f: dict) -> Frame:
    a = f["asymmetry"]
    # JSON has no NaN: a null component stands for a non-finite measurement.
    asymmetry = a and Point(*(math.nan if v is None else v for v in a))
    return Frame(ok=f["ok"], reasons=f["reasons"], eyes_found=f["eyesFound"], asymmetry=asymmetry)


@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda c: c["name"])
def test_summary_matches_core(case):
    s = summarize_frames([frame(f) for f in case["frames"]])
    expected = case["expected"]
    assert s.frames_total == expected["framesTotal"]
    assert s.frames_used == expected["framesUsed"]
    assert s.quality_reasons == expected["qualityReasons"]
    for actual, want in (
        (s.asymmetry_score, expected["asymmetryScore"]),
        (s.spread, expected["spread"]),
    ):
        assert actual == (None if want is None else pytest.approx(want, abs=1e-6))
