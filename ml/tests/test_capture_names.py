"""The capture file name is parsed in three places; they must agree on every valid name."""

import itertools

import pytest

from dataset.prelabel import parse_name
from hirschberg.calibration import capture_key
from hirschberg.summarize import capture_of

ANGLES = {"00": 0.0, "25": 2.5, "05": 5.0, "10": 10.0}
CONDITIONS = ["N", "D", "C00"] + [f"C{a}{d}" for a in ("25", "05", "10") for d in "LR"]
NAMES = [
    f"P{person:03d}_{condition}_r{repeat}_{device}_2026102{day}"
    for person, condition, repeat, device, day in itertools.product(
        (1, 42, 999), CONDITIONS, (1, 3), ("ip13", "ip15pro"), (4, 7)
    )
]


@pytest.mark.parametrize("name", NAMES)
def test_every_protocol_name_parses_the_same_everywhere(name):
    meta = parse_name(name)
    assert meta is not None
    frame = f"{name}_f12.jpg"
    assert capture_of(frame) == name
    assert parse_name(capture_of(frame)) == meta
    key = capture_key(frame)
    if meta["scan_type"] != "C":
        assert key is None
        return
    assert key["person"] == meta["person_id"]
    assert key["device"] == meta["device"]
    assert key["repeat"] == meta["repeat"]
    sign = -1 if meta["dir"] == "L" else 1
    assert key["angle_deg"] == sign * ANGLES[meta["angle"]]


@pytest.mark.parametrize(
    "name",
    [
        "IMG_0001",
        "P001_X_r1_ip13_20261024",
        "P001_N_1_ip13_20261024",
        "P001_N_r1_IP13_20261024",
        "P001_N_r1_ip13_2026102",
    ],
)
def test_names_off_the_protocol_are_rejected_everywhere(name):
    assert parse_name(name) is None
    assert capture_key(f"{name}_f3.jpg") is None


@pytest.mark.parametrize("name", ["P001_C05_r1_ip13_20261024", "P001_C00L_r1_ip13_20261024"])
def test_calibration_names_with_a_wrong_direction_are_not_calibration_captures(name):
    """A non-zero angle needs L or R, and 0 degrees has none.

    The naming regex alone accepts these, so the data sheet check has to flag them; the
    calibration analysis ignores them.
    """
    assert parse_name(name) is not None
    assert capture_key(f"{name}_f3.jpg") is None


def test_frame_suffix_is_only_stripped_at_the_end():
    assert capture_of("P001_N_r1_ip13_20261024_f3.jpg") == "P001_N_r1_ip13_20261024"
    assert capture_of("P001_f3_N.jpg") == "P001_f3_N"
