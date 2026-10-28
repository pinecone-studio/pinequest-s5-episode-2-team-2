import json

import cv2
import numpy as np
import pytest

pytest.importorskip("torch", reason="needs the train group: uv sync --group train")

from keypoints.cv import main as cv_main  # noqa: E402
from keypoints.cv import person_folds  # noqa: E402
from keypoints.data import EyeCrops, hflip, label_vector  # noqa: E402
from keypoints.metrics import keypoint_errors  # noqa: E402
from keypoints.train import main  # noqa: E402


def write_crop(path, iris, radius, reflex):
    image = np.full((96, 96, 3), 190, np.uint8)
    cv2.circle(image, iris, radius, (60, 50, 40), -1, cv2.LINE_AA)
    if reflex is not None:
        cv2.circle(image, reflex, 2, (255, 255, 255), -1, cv2.LINE_AA)
    cv2.imwrite(str(path), image)


@pytest.fixture
def manifest(tmp_path):
    rng = np.random.default_rng(0)
    rows = []
    for i in range(24):
        iris = (int(rng.integers(35, 60)), int(rng.integers(35, 60)))
        radius = int(rng.integers(14, 20))
        reflex = None if i % 6 == 0 else (iris[0] + int(rng.integers(-5, 6)), iris[1])
        write_crop(tmp_path / f"{i}.png", iris, radius, reflex)
        label = {
            "iris_center": list(iris),
            "iris_radius": radius,
            "reflex": list(reflex) if reflex else None,
        }
        rows.append(
            {
                "crop": f"{i}.png",
                "person_id": f"P{i // 4}",
                "split": "test" if i >= 18 else "train",
                **label,
                "heuristic": {**label, "iris_radius": radius + 1},
            }
        )
    path = tmp_path / "manifest.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in rows))
    return path


def test_label_vector_normalizes_by_crop_size():
    v = label_vector({"iris_center": [48, 24], "iris_radius": 12, "reflex": None}, 96, 48)
    assert v.tolist() == pytest.approx([0.5, 0.5, 0.125, 0, 0, 0])


def test_hflip_moves_labels_with_pixels():
    image = np.zeros((4, 4, 3), np.float32)
    target = np.array([0.25, 0.5, 0.1, 0.3, 0.5, 1], np.float32)
    flipped, t = hflip(image, target)
    assert t[0] == pytest.approx(0.75) and t[3] == pytest.approx(0.7)
    assert t[1] == target[1] and t[2] == target[2]


def test_errors_are_normalized_by_radius():
    target = np.array([[0.5, 0.5, 0.1, 0.5, 0.5, 1]])
    pred = np.array([[0.55, 0.5, 0.1, 0.5, 0.45, 0.9]])
    m = keypoint_errors(pred, target)
    assert m["center_median"] == pytest.approx(0.5)
    assert m["reflex_median"] == pytest.approx(0.5)
    assert m["reflex_visible_accuracy"] == 1


def test_dataset_shapes(manifest):
    image, target = EyeCrops(manifest, "train", 64, augment=True)[0]
    assert image.shape == (3, 64, 64) and target.shape == (6,)


def test_train_and_evaluate_from_config(manifest, tmp_path, capsys):
    config = tmp_path / "config.toml"
    # POSIX paths: Windows backslashes are escape sequences in TOML strings.
    runs = (tmp_path / "runs").as_posix()
    config.write_text(
        f'manifest = "{manifest.as_posix()}"\nruns_dir = "{runs}"\nrun_name = "t"\nseed = 0\n'
        "image_size = 64\nepochs = 1\nbatch_size = 8\nlr = 1e-3\nweight_decay = 0\n"
        "pretrained = false\n"
    )
    assert main([str(config)]) == 0
    metrics = json.loads((tmp_path / "runs/t/metrics.json").read_text())
    assert metrics["test"]["model"]["n"] == 6
    assert metrics["test"]["heuristic"]["radius_median"] > 0
    assert (tmp_path / "runs/t/model.pt").is_file()
    assert "| heuristic |" in capsys.readouterr().out


def test_person_folds_hold_out_every_crop_once_and_never_split_a_person():
    rows = [{"person_id": f"P{i // 3}"} for i in range(15)]
    folds = person_folds(rows, 3, seed=0)
    assert sorted(i for fold in folds for i in fold) == list(range(15))
    for fold in folds:
        held = {rows[i]["person_id"] for i in fold}
        rest = {row["person_id"] for i, row in enumerate(rows) if i not in fold}
        assert held and not held & rest


def test_person_folds_need_people():
    with pytest.raises(ValueError, match="person_id"):
        person_folds([{"person_id": "P1"}, {}], 2, seed=0)
    with pytest.raises(ValueError, match="cannot fill"):
        person_folds([{"person_id": "P1"}, {"person_id": "P2"}], 3, seed=0)


def test_cross_validation_reports_every_crop_without_weights(manifest, tmp_path, capsys):
    config = tmp_path / "config.toml"
    runs = (tmp_path / "runs").as_posix()
    config.write_text(
        f'manifest = "{manifest.as_posix()}"\nruns_dir = "{runs}"\nrun_name = "t"\nseed = 0\n'
        "image_size = 64\nepochs = 1\nbatch_size = 8\nlr = 1e-3\nweight_decay = 0\n"
        "pretrained = false\n"
    )
    assert cv_main([str(config), "--folds", "3"]) == 0
    report = json.loads((tmp_path / "runs/t-cv3/cv.json").read_text())
    assert report["test"]["model"]["n"] == 24 and sum(report["fold_sizes"]) == 24
    assert report["people"] == 6 and report["test"]["heuristic"]["n"] == 24
    assert not list((tmp_path / "runs").rglob("*.pt"))
    assert "| heuristic |" in capsys.readouterr().out
