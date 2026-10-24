import json

import numpy as np
import pytest

torch = pytest.importorskip("torch", reason="needs the train group: uv sync --group train")

from keypoints.data import IMAGENET_MEAN, IMAGENET_STD  # noqa: E402
from keypoints.export import OnDeviceModel, compare, main, synthetic_crops  # noqa: E402
from keypoints.train import build_model  # noqa: E402


def test_on_device_model_matches_training_preprocessing():
    torch.manual_seed(0)
    model = build_model(pretrained=False).eval()
    crops = synthetic_crops(3, 64, seed=0)
    # What keypoints.data and keypoints.train do: normalize, HWC -> CHW, sigmoid on visibility.
    chw = np.ascontiguousarray(((crops - IMAGENET_MEAN) / IMAGENET_STD).transpose(0, 3, 1, 2))
    with torch.no_grad():
        expected = model(torch.from_numpy(chw))
        expected[:, 5] = torch.sigmoid(expected[:, 5])
        actual = OnDeviceModel(model).eval()(torch.from_numpy(crops))
    assert torch.allclose(actual, expected, atol=1e-6)


def test_synthetic_crops_are_deterministic_rgb_in_unit_range():
    crops = synthetic_crops(4, 32, seed=1)
    assert crops.shape == (4, 32, 32, 3) and crops.dtype == np.float32
    assert crops.min() >= 0 and crops.max() <= 1
    assert np.array_equal(crops, synthetic_crops(4, 32, seed=1))


def test_compare_flags_differences_above_tolerance():
    reference = np.zeros((2, 6), np.float32)
    close = compare(reference, reference + 5e-5, atol=1e-4)
    far = compare(reference, reference + np.array([0, 0, 0, 0, 0, 1e-3], np.float32), atol=1e-4)
    assert close["ok"] and not far["ok"]
    assert far["max_abs_diff"]["reflex_visible"] == pytest.approx(1e-3)


def test_missing_weights_exit_code(tmp_path):
    config = tmp_path / "config.toml"
    runs = (tmp_path / "runs").as_posix()
    config.write_text(f'runs_dir = "{runs}"\nrun_name = "t"\nseed = 0\nimage_size = 64\n')
    assert main([str(config)]) == 2


def test_export_matches_pytorch(tmp_path):
    pytest.importorskip("litert_torch", reason="conversion needs Linux, see ml/README.md")
    pytest.importorskip("ai_edge_litert")
    run_dir = tmp_path / "runs" / "t"
    run_dir.mkdir(parents=True)
    torch.save(build_model(pretrained=False).state_dict(), run_dir / "model.pt")
    config = tmp_path / "config.toml"
    runs = (tmp_path / "runs").as_posix()
    config.write_text(f'runs_dir = "{runs}"\nrun_name = "t"\nseed = 0\nimage_size = 64\n')
    assert main([str(config)]) == 0
    report = json.loads((run_dir / "export.json").read_text())
    assert report["ok"] and (run_dir / "keypoints.tflite").is_file()
