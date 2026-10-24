# Model card: eye keypoint model

Status: **draft**. Sections marked `TODO` are filled in once the training data (#6, #29) and
the evaluation (#17) exist.

## Model

- **Task:** find the iris centre, the iris radius and the corneal light reflex in one eye
  crop. The app turns these into the Hirschberg reflex offset (#19).
- **Architecture:** MobileNetV3-Small (`timm` `mobilenetv3_small_100`, ImageNet weights) with
  a linear head of 6 outputs.
- **Code:** `ml/keypoints/` (`train.py` trains and evaluates, `export.py` converts to TFLite).
- **Version:** `TODO(#17)`: run name, config and commit of the released weights.

## On-device contract

The app runs `keypoints.tflite` (float32):

| Tensor | Shape              | Meaning                                                           |
| ------ | ------------------ | ----------------------------------------------------------------- |
| Input  | `[1, 128, 128, 3]` | RGB eye crop resized to 128 × 128, values divided by 255 (0 to 1) |
| Output | `[1, 6]`           | iris x, iris y, iris radius, reflex x, reflex y, reflex visible   |

- ImageNet normalization and the sigmoid are inside the model.
- x and the radius are fractions of the crop width, y is a fraction of the crop height.
  Multiply back to get crop pixels.
- `reflex visible` is a probability. Below 0.5 the reflex position is meaningless.

## Intended use

- Screening aid: the measurement feeds the decision policy in `packages/core`, which only says
  whether seeing an eye doctor is recommended. It does not diagnose.
- Training crops follow `docs/capture-protocol.md`; other capture conditions are untested.
- Out of scope: diagnosing strabismus, measuring the deviation in degrees or prism dioptres.

## Training data

`TODO(#6, #29)`: sources, number of people and crops, age range, lighting, how the split keeps
each person in one split, and consent. Images stay in the team Drive and are never committed.

## Evaluation

`TODO(#17)`: model vs heuristic on the test split. Errors are normalized by the labelled iris
radius (`ml/keypoints/metrics.py`).

## Export

- Converted with `litert-torch` by `python -m keypoints.export` (see `ml/README.md`).
- Checked against PyTorch on 16 synthetic eye crops; the export fails if any output differs
  by more than 1e-4. `TODO(#18)`: measured difference for the released weights.
- `TODO`: iPhone latency on CPU vs CoreML. For MediaPipe's face models the CPU delegate was
  faster (`docs/spikes/tflite.md`).

## Limitations

- The model only sees one eye crop. A bad crop (eye not centred, blur, glare) gives a bad
  measurement; frame quality checks (#5) must reject those frames first.
- `TODO(#17)`: results on the cases that motivated the model (dark irises, eyelashes, partly
  closed lids), and any group where the error is clearly higher.
