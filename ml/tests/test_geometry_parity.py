import json
import math
from pathlib import Path

import pytest

from hirschberg.measure import Point, mirrored_asymmetry, reflex_offset

FIXTURES = json.loads(
    (Path(__file__).parents[2] / "packages/core/fixtures/geometry.json").read_text("utf8")
)


@pytest.mark.parametrize("case", FIXTURES["offsets"], ids=lambda c: c["name"])
def test_reflex_offset_matches_core(case):
    offset = reflex_offset(Point(*case["irisCenter"]), case["irisRadius"], Point(*case["reflex"]))
    assert [offset.x, offset.y] == pytest.approx(case["expected"], abs=1e-9)


@pytest.mark.parametrize("case", FIXTURES["asymmetry"], ids=lambda c: c["name"])
def test_mirrored_asymmetry_matches_core(case):
    a = mirrored_asymmetry(Point(*case["imageLeft"]), Point(*case["imageRight"]))
    assert [a.x, a.y] == pytest.approx(case["expected"]["asymmetry"], abs=1e-9)
    assert math.hypot(a.x, a.y) == pytest.approx(case["expected"]["magnitude"], abs=1e-9)
