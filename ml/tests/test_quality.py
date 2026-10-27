import json
from pathlib import Path

import numpy as np
import pytest

from hirschberg.measure import Point
from hirschberg.quality import CropStats, assess_quality, crop_stats

FIXTURES = json.loads(
    (Path(__file__).parents[2] / "packages/core/fixtures/quality.json").read_text("utf8")
)


def landmarks(points: dict[str, list[float]]) -> list[Point]:
    lm = [Point(500, 550)] * 478
    for i, (x, y) in points.items():
        lm[int(i)] = Point(x, y)
    return lm


@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda c: c["name"])
def test_quality_matches_core(case):
    eyes = case["eyes"]
    crops = case["crops"]
    q = assess_quality(
        frame_size=tuple(case["frameSize"]),
        face_count=case["faceCount"],
        landmarks=landmarks(case["points"]) if case["faceCount"] == 1 else [],
        iris_radii=eyes and tuple(e["irisRadius"] for e in eyes),
        reflex_found=eyes and tuple(e["reflexOffset"] is not None for e in eyes),
        crops=crops and tuple(CropStats(**c) for c in crops),
    )
    expected = case["expected"]
    assert q.reasons == expected["reasons"]
    assert q.ok == (not expected["reasons"])
    for key in ("sharpness", "exposure"):
        assert getattr(q, key) == pytest.approx(expected[key], abs=1e-6)
    if expected["headPose"] is None:
        assert q.head_pose is None
    else:
        for key, value in expected["headPose"].items():
            assert getattr(q.head_pose, key) == pytest.approx(value, abs=1e-6)


@pytest.mark.parametrize("case", FIXTURES["crops"], ids=lambda c: c["name"])
def test_crop_stats_match_core(case):
    luma = np.array(case["luma"], dtype=np.float64).reshape(case["height"], case["width"])
    stats = crop_stats(luma)
    if case["expected"] is None:
        assert stats is None
    else:
        for key, value in case["expected"].items():
            assert getattr(stats, key) == pytest.approx(value, abs=1e-6)


def test_crop_stats_rejects_invalid_crops():
    assert crop_stats(np.full((4, 4), np.nan)) is None
    assert crop_stats(np.zeros(16)) is None


def test_multiple_reflexes_reject_the_frame_when_counts_are_given():
    case = next(c for c in FIXTURES["cases"] if c["name"] == "frontal")
    args = dict(
        frame_size=tuple(case["frameSize"]),
        face_count=1,
        landmarks=landmarks(case["points"]),
        iris_radii=(48, 48),
        reflex_found=(True, True),
    )
    assert assess_quality(**args).reasons == []
    assert assess_quality(**args, reflex_counts=(1, 1)).reasons == []
    q = assess_quality(**args, reflex_counts=(2, 1))
    assert not q.ok and q.reasons == ["MULTIPLE_REFLEXES"]
