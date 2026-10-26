import json
import math
from pathlib import Path

import pytest

from hirschberg.aggregate import ScanSummary
from hirschberg.policy import PolicyConfig, decide

FIXTURES = json.loads(
    (Path(__file__).parents[2] / "packages/core/fixtures/policy.json").read_text("utf8")
)
CONFIG = PolicyConfig(
    refer_asymmetry=FIXTURES["config"]["referAsymmetry"],
    min_frames_used=FIXTURES["config"]["minFramesUsed"],
    max_spread=FIXTURES["config"]["maxSpread"],
)


@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda c: c["name"])
def test_decision_matches_core(case):
    s = case["summary"]
    summary = ScanSummary(
        frames_total=s["framesTotal"],
        frames_used=s["framesUsed"],
        asymmetry_score=s["asymmetryScore"],
        spread=s["spread"],
        quality_reasons=case["qualityReasons"],
    )
    decision = decide(summary, case["failure"], CONFIG)
    assert {"outcome": decision.outcome, "reasons": decision.reasons} == case["expected"]


def test_non_finite_score_is_a_model_error():
    summary = ScanSummary(30, 20, math.nan, 0.01, [])
    assert decide(summary, None, CONFIG).reasons == ["MODEL_ERROR"]


@pytest.mark.parametrize(
    ("refer", "frames", "spread"), [(0, 5, 0.1), (math.nan, 5, 0.1), (0.2, 0, 0.1), (0.2, 5, -1)]
)
def test_rejects_invalid_config(refer, frames, spread):
    with pytest.raises(ValueError):
        PolicyConfig(refer_asymmetry=refer, min_frames_used=frames, max_spread=spread)
