"""Exports the trained eye keypoint model to TFLite and checks it against PyTorch.

Usage: python -m keypoints.export configs/keypoints-baseline.toml

Reads runs/<run_name>/model.pt written by `keypoints.train`, writes
runs/<run_name>/keypoints.tflite and export.json, and prints the largest difference between
PyTorch and TFLite outputs on synthetic eye crops. Exits with 1 if it is above the tolerance.

Conversion needs litert-torch, which officially supports Linux only (see ml/README.md).
"""

from __future__ import annotations

import argparse
import json
import sys
import tomllib
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn

from keypoints.data import IMAGENET_MEAN, IMAGENET_STD
from keypoints.train import build_model

OUTPUTS = ["iris_x", "iris_y", "iris_radius", "reflex_x", "reflex_y", "reflex_visible"]
# Outputs are fractions of the crop size, so 1e-4 is about 0.01 px on a 128 px crop.
DEFAULT_ATOL = 1e-4
NUM_FIXTURES = 16


class OnDeviceModel(nn.Module):
    """The model as the app runs it: a plain RGB crop in, final values out.

    Input: [1, S, S, 3] float32 RGB in [0, 1] (NHWC, like the MediaPipe face models).
    Output: [1, 6] iris x, y, radius and reflex x, y as fractions of the crop size, then the
    reflex-visible probability. ImageNet normalization and the sigmoid are inside the model,
    so the app only resizes the crop and divides by 255.
    """

    def __init__(self, model: nn.Module):
        super().__init__()
        self.model = model
        self.register_buffer("mean", torch.from_numpy(IMAGENET_MEAN).view(1, 3, 1, 1))
        self.register_buffer("std", torch.from_numpy(IMAGENET_STD).view(1, 3, 1, 1))

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        x = (image.permute(0, 3, 1, 2) - self.mean) / self.std
        out = self.model(x)
        return torch.cat([out[:, :5], torch.sigmoid(out[:, 5:])], dim=1)


def load_trained(weights: Path) -> nn.Module:
    model = build_model(pretrained=False)
    model.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True))
    return model.eval()


def synthetic_crops(n: int, size: int, seed: int) -> np.ndarray:
    """Eye-like inputs drawn in code (skin, dark iris, usually a reflex), so no real images.

    Returns [n, size, size, 3] float32 RGB in [0, 1].
    """
    rng = np.random.default_rng(seed)
    crops = []
    for i in range(n):
        image = np.full((size, size, 3), int(rng.integers(150, 220)), np.uint8)
        center = tuple(int(v) for v in rng.integers(size // 3, 2 * size // 3, 2))
        radius = int(rng.integers(size // 8, size // 5))
        iris_color = tuple(int(v) for v in rng.integers(20, 90, 3))
        cv2.circle(image, center, radius, iris_color, -1, cv2.LINE_AA)
        if i % 4:
            reflex = (center[0] + int(rng.integers(-radius // 2, radius // 2 + 1)), center[1])
            cv2.circle(image, reflex, max(1, size // 64), (255, 255, 255), -1, cv2.LINE_AA)
        crops.append(image)
    return np.stack(crops).astype(np.float32) / 255


def convert(model: nn.Module, size: int, path: Path) -> None:
    import litert_torch

    with torch.no_grad():
        edge_model = litert_torch.convert(model, (torch.zeros(1, size, size, 3),))
    edge_model.export(str(path))


def run_torch(model: nn.Module, inputs: np.ndarray) -> np.ndarray:
    with torch.no_grad():
        return model(torch.from_numpy(inputs)).numpy()


def run_tflite(path: Path, inputs: np.ndarray) -> np.ndarray:
    """Runs the exported file with the standalone LiteRT interpreter, one crop at a time."""
    from ai_edge_litert.interpreter import Interpreter

    interpreter = Interpreter(model_path=str(path))
    interpreter.allocate_tensors()
    (input_detail,) = interpreter.get_input_details()
    (output_detail,) = interpreter.get_output_details()
    outputs = []
    for crop in inputs:
        interpreter.set_tensor(input_detail["index"], crop[None])
        interpreter.invoke()
        outputs.append(interpreter.get_tensor(output_detail["index"])[0].copy())
    return np.stack(outputs)


def compare(torch_out: np.ndarray, tflite_out: np.ndarray, atol: float) -> dict:
    diff = np.abs(torch_out - tflite_out).max(axis=0)
    return {
        "max_abs_diff": dict(zip(OUTPUTS, diff.tolist(), strict=True)),
        "atol": atol,
        "ok": bool(diff.max() <= atol),
    }


def markdown_table(report: dict) -> str:
    lines = ["| output | max abs diff |", "|---|---|"]
    lines += [f"| {name} | {d:.2e} |" for name, d in report["max_abs_diff"].items()]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("config", type=Path)
    parser.add_argument("--atol", type=float, default=DEFAULT_ATOL)
    args = parser.parse_args(argv)
    cfg = tomllib.loads(args.config.read_text())
    run_dir = Path(cfg.get("runs_dir", "runs")) / cfg["run_name"]
    weights = run_dir / "model.pt"
    if not weights.is_file():
        print(f"No trained weights at {weights}; run keypoints.train first", file=sys.stderr)
        return 2

    size = cfg["image_size"]
    model = OnDeviceModel(load_trained(weights)).eval()
    tflite = run_dir / "keypoints.tflite"
    convert(model, size, tflite)

    fixtures = synthetic_crops(NUM_FIXTURES, size, cfg["seed"])
    report = {
        "tflite": str(tflite),
        "input": f"[1, {size}, {size}, 3] float32 RGB in [0, 1]",
        "output": "[1, 6] " + ", ".join(OUTPUTS),
        "fixtures": NUM_FIXTURES,
        **compare(run_torch(model, fixtures), run_tflite(tflite, fixtures), args.atol),
    }
    (run_dir / "export.json").write_text(json.dumps(report, indent=2))
    print(markdown_table(report))
    if not report["ok"]:
        print(f"TFLite differs from PyTorch by more than {args.atol}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
