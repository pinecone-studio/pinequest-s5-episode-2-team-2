import cv2
import numpy as np
import pytest

from dataset.prelabel import crop_eye, make_task, parse_name, read_frames
from hirschberg.measure import EyeMeasure, Point


@pytest.mark.parametrize(
    ("stem", "person", "condition", "repeat", "device"),
    [
        ("P007_N_r2_ip13_20261024", "P007", "N", 2, "ip13"),
        ("P007_C05L_r1_ip13_20261024", "P007", "C05L", 1, "ip13"),
        ("P007_C00_r1_ip13_20261024", "P007", "C00", 1, "ip13"),
        ("P012_D_r1_ip15_20261025", "P012", "D", 1, "ip15"),
    ],
)
def test_parse_protocol_names(stem, person, condition, repeat, device):
    meta = parse_name(stem)
    assert (meta["person_id"], meta["condition"], meta["repeat"], meta["device"]) == (
        person,
        condition,
        repeat,
        device,
    )


@pytest.mark.parametrize("stem", ["IMG_0042", "P007_N_ip13_20261024", "anna_N_r1_ip13_20261024"])
def test_reject_other_names(stem):
    assert parse_name(stem) is None


def test_crop_is_centred_and_padded_at_the_edge():
    image = np.zeros((100, 100, 3), np.uint8)
    image[5, 8] = 255
    crop, x0, y0 = crop_eye(image, 8, 5, 10)
    assert crop.shape == (50, 50, 3)
    assert (x0, y0) == (8 - 25, 5 - 25)
    assert crop[25, 25].tolist() == [255, 255, 255]


def test_task_has_keypoints_in_crop_percent():
    eye = EyeMeasure("imageLeft", Point(120, 80), 10, Point(123, 78), None, 1.0)
    task = make_task("/img.png", 50, eye, 95, 55, {"person_id": "P007"})
    points = {r["value"]["keypointlabels"][0]: r["value"] for r in task["predictions"][0]["result"]}
    assert points["iris_center"]["x"] == pytest.approx(50) and points["iris_center"]["y"] == 50
    assert points["iris_edge"]["x"] == pytest.approx(70)
    assert points["reflex"]["x"] == pytest.approx(56) and points["reflex"]["y"] == 46
    assert task["data"]["image"] == "/img.png" and task["data"]["person_id"] == "P007"
    heuristic = task["data"]["heuristic"]
    assert heuristic["iris_center"] == [25, 25] and heuristic["iris_radius"] == 10
    assert heuristic["reflex"] == [28, 23]


def test_task_without_reflex_has_no_reflex_point():
    eye = EyeMeasure("imageRight", Point(25, 25), 10, None, None, 0.0)
    labels = [
        r["value"]["keypointlabels"][0]
        for r in make_task("x", 50, eye, 0, 0, {})["predictions"][0]["result"]
    ]
    assert labels == ["iris_center", "iris_edge"]


def test_read_frames_samples_the_middle_of_a_video(tmp_path):
    path = tmp_path / "P001_N_r1_ip13_20261024.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 30, (32, 32))
    for i in range(30):
        writer.write(np.full((32, 32, 3), i * 8, np.uint8))
    writer.release()
    frames = read_frames(path, 3)
    assert [i for i, _ in frames] == [6, 15, 24]


def test_crop_rounds_like_the_app():
    # eyeRegions in the app: size = roundEven(5r), x = roundEven(cx) - floor(size / 2).
    # roundEven(12.5) = 12, roundEven(10.5) = 10, roundEven(11.5) = 12.
    image = np.zeros((40, 40, 3), np.uint8)
    crop, x0, y0 = crop_eye(image, 10.5, 11.5, 2.5)
    assert crop.shape[0] == 12
    assert (x0, y0) == (10 - 6, 12 - 6)
