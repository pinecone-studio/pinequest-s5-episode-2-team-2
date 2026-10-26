import csv

import cv2
import numpy as np
import pytest

from dataset.frames import REPO_ROOT, every_nth_frame, extract, inside_repo, main


def write_video(path, frames: int = 10, size=(64, 48)) -> None:
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 30, size)
    for i in range(frames):
        writer.write(np.full((size[1], size[0], 3), i * 20, np.uint8))
    writer.release()


@pytest.fixture
def captures(tmp_path):
    folder = tmp_path / "captures"
    folder.mkdir()
    write_video(folder / "P001_N_r1_ip13_20261024.mp4")
    write_video(folder / "P001_D_r1_ip13_20261024.mp4")
    write_video(folder / "holiday.mp4")
    (folder / "notes.txt").write_text("not a video", "utf8")
    return folder


def test_every_nth_frame(tmp_path):
    path = tmp_path / "v.mp4"
    write_video(path, frames=10)
    assert [i for i, _ in every_nth_frame(path, 3)] == [0, 3, 6, 9]


def test_extract_names_frames_after_their_capture(captures, tmp_path):
    out = tmp_path / "frames"
    out.mkdir()
    sheet = {"P001_D_r1_ip13_20261024": {"usable": "no"}}
    written, skipped = extract(captures, out, step=5, sheet=sheet)
    assert written == 2
    assert sorted(p.name for p in out.iterdir()) == [
        "P001_N_r1_ip13_20261024_f0.jpg",
        "P001_N_r1_ip13_20261024_f5.jpg",
    ]
    assert skipped == {"P001_D_r1_ip13_20261024.mp4": "NOT_USABLE", "holiday.mp4": "BAD_NAME"}


def test_unreadable_video_is_reported(tmp_path):
    folder = tmp_path / "captures"
    folder.mkdir()
    (folder / "P001_N_r1_ip13_20261024.mov").write_bytes(b"not a video")
    out = tmp_path / "frames"
    out.mkdir()
    assert extract(folder, out, 3, {}) == (0, {"P001_N_r1_ip13_20261024.mov": "UNREADABLE"})


def test_refuses_to_write_inside_the_repo(captures, capsys):
    assert inside_repo(REPO_ROOT / "data" / "frames")
    assert main([str(captures), str(REPO_ROOT / "ml" / "frames-out")]) == 2
    assert "Refusing" in capsys.readouterr().err
    assert not (REPO_ROOT / "ml" / "frames-out").exists()


def test_cli_with_sheet(captures, tmp_path, capsys):
    sheet = tmp_path / "sheet.csv"
    with sheet.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["file_name", "usable"])
        writer.writeheader()
        writer.writerow({"file_name": "P001_N_r1_ip13_20261024.mp4", "usable": "no"})
    out = tmp_path / "out"
    assert main([str(captures), str(out), "--step", "10", "--sheet", str(sheet)]) == 0
    printed = capsys.readouterr().out
    assert f"Wrote 1 frames to {out}." in printed
    assert "Skipped P001_N_r1_ip13_20261024.mp4: NOT_USABLE" in printed
    with pytest.raises(SystemExit):
        main([str(captures), str(out), "--step", "0"])
