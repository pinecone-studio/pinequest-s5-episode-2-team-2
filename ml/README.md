# ml

Python 3.11 code for the eye measurement algorithm, training and evaluation.

## hirschberg

Heuristic baseline for the corneal light reflex (Hirschberg principle). For each eye it finds
the iris centre, the iris radius and the reflex, then reports the reflex offset normalized by
the iris radius. The output is unitless; there is no millimetre or degree conversion.

1. MediaPipe Face Landmarker gives a rough iris centre and radius for both eyes.
2. OpenCV refines the iris by fitting a circle to the dark iris blob.
3. The reflex is the intensity-weighted centroid of the largest bright blob inside the iris.
4. `asymmetry` compares the two offsets after mirroring the image-right eye, matching
   `mirroredAsymmetry` in `packages/core`.

Thresholds in `hirschberg/measure.py` marked `TODO(tune)` are placeholders until the
calibration data is analysed.

## Setup

Install [uv](https://docs.astral.sh/uv/), then from `ml/`:

```bash
uv sync
```

Download the Face Landmarker model (not committed):

```bash
mkdir -p models
curl -L -o models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
```

## Usage

```bash
uv run python -m hirschberg.cli path/to/images
```

Prints one JSON line per `.jpg`, `.jpeg` or `.png` image: per-eye `iris_center`,
`iris_radius`, `reflex`, `reflex_offset` and `confidence`, plus `asymmetry`, or an `error`
(`NO_FACE`, `MULTIPLE_FACES`, `UNREADABLE`). Images are only read, never written or uploaded.
Keep image folders outside the repo.

## dataset

Pre-labeling for Label Studio (#6). `dataset.prelabel` reads captures named as in
`docs/capture-protocol.md` section 6 (videos or images), takes 3 frames from the middle of each
video, cuts a square crop around each iris (5 iris radii wide) and writes the heuristic iris
centre, iris edge and reflex as Label Studio predictions. Files that do not follow the naming
scheme, or are marked `usable = no` in the data sheet, are skipped and listed.

```bash
uv run python -m dataset.prelabel /path/to/session /path/to/batch --sheet sheet.csv
```

The output folder (`crops/` and `tasks.json`) belongs on the private Drive, never in the repo.
The labeling config is `dataset/labelstudio.xml`; setup and labeling rules are in
`docs/annotation-guide.md`.

## keypoints

Eye keypoint model (#17): an ImageNet MobileNetV3-Small from `timm` with a small regression
head. Input is one eye crop resized to 128 × 128; outputs are iris centre, iris radius, reflex
position and a reflex-visible score. It needs the extra `train` dependency group:

```bash
uv sync --group train
uv run python -m keypoints.train configs/keypoints-baseline.toml
```

The command trains on the `train` split, evaluates on `test`, writes `runs/<run_name>/model.pt`
and `metrics.json`, and prints a model vs heuristic table. Errors are normalized by the
labelled iris radius. `runs/` and `data/` are git-ignored; share weights through the Drive.

The dataset builder writes `data/keypoints/manifest.jsonl`, one line per eye crop. Coordinates
are crop pixels, paths are relative to the manifest, and the split must keep each `person_id`
in a single split. `reflex` is `null` when no reflex is visible; `heuristic` is the
`hirschberg` result for the same crop and may be left out.

`dataset.build` writes it from one or more Label Studio JSON exports of a batch. It copies the
used crops next to the manifest and splits people 70/15/15 with a fixed seed, so nobody is in
two splits. Crops flagged `unclear` or missing the iris points are left out:

```bash
uv run python -m dataset.build /path/to/batch export_*.json --out data/keypoints
```

```json
{
  "crop": "S03/P007_N_r1_L.png",
  "split": "train",
  "iris_center": [48.2, 51.0],
  "iris_radius": 17.5,
  "reflex": [50.1, 49.3],
  "heuristic": { "iris_center": [47.9, 51.4], "iris_radius": 18.1, "reflex": [50.0, 49.5] }
}
```

### Export to TFLite (#18)

`keypoints.export` converts `runs/<run_name>/model.pt` to `runs/<run_name>/keypoints.tflite`
with [litert-torch](https://github.com/google-ai-edge/litert-torch) (the new name of
ai-edge-torch). It then runs both models on 16 synthetic eye crops drawn in code and fails if
any output differs by more than `--atol` (default 1e-4). The input/output contract is in
`docs/model-card.md`.

litert-torch officially supports Linux only, and its converter has no Windows wheel. Run the
export in Colab or on Linux; macOS arm64 wheels exist but are not officially supported. The
export packages are passed with `--with` instead of a dependency group, so `uv sync` keeps
working on every OS:

```bash
uv run --group train --with litert-torch==0.10.0 --with ai-edge-litert==2.3.0 \
  python -m keypoints.export configs/keypoints-baseline.toml
```

## Checks

GitHub Actions is not available for this repo, so run these before every push:

```bash
uv run ruff format --check .
uv run ruff check .
uv run pytest
```
