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

## Checks

GitHub Actions is not available for this repo, so run these before every push:

```bash
uv run ruff format --check .
uv run ruff check .
uv run pytest
```
