# Model card: eye keypoint model

Status: **draft, preliminary results**. The first model was trained on one small pilot batch
(12 people, no torch). The numbers below show that the pipeline works end to end; they are not
evidence that the model is good enough to use. Sections marked `TODO` wait for the protocol
captures (#29).

## Model

- **Task:** find the iris centre, the iris radius and the corneal light reflex in one eye
  crop. The app turns these into the Hirschberg reflex offset (#19).
- **Architecture:** MobileNetV3-Small (`timm` `mobilenetv3_small_100`, ImageNet weights) with
  a linear head of 6 outputs.
- **Code:** `ml/keypoints/` (`train.py` trains and evaluates, `export.py` converts to TFLite).
- **Version:** no released weights yet. Pilot run `batch01-v2-bs16-e200`: the baseline config
  with `batch_size = 16` and `epochs = 200`, trained at commit `b5a2504` on an Apple M3 (MPS)
  in under two minutes. Weights are on the team Drive, not in git.

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

Pilot batch 01 (October 2026):

- 39 still photos of 12 people (P001–P012) from one iPhone 12 Pro Max, all with signed consent.
  Indoor light, **no torch**, so no corneal torch reflex is visible. Not captured with
  `docs/capture-protocol.md`; distance and age were not recorded.
- 78 eye crops from `dataset.prelabel` (raw Face Landmarker iris, the same crop as the app), 75
  labelled in Label Studio by one annotator, 3 left unlabelled. No crop was flagged `unclear`
  and none has a reflex point.
- Split by person with `dataset.build` (seed 0): train 8 people / 49 crops, val 2 / 14, test
  2 / 12. Nobody is in two splits.
- Images stay in the team Drive and are never committed.

`TODO(#29)`: the protocol captures (children and adults, torch on, about 35 cm) and a second
annotator on 20 crops to measure agreement (#34).

## Evaluation

Pilot batch 01, test split (2 people, 12 crops). Errors are distances divided by the labelled
iris radius (`ml/keypoints/metrics.py`); lower is better.

| Method    | Centre, median | Centre, p90 | Radius, median | Reflex visible, accuracy |
| --------- | -------------- | ----------- | -------------- | ------------------------ |
| Model     | 0.171          | 0.254       | 0.128          | 1.00                     |
| Heuristic | 0.167          | 0.317       | 0.227          | 0.00                     |

- The model halves the radius error and has fewer large centre errors; on the median centre
  error the two are level.
- With no torch reflex in the data, "reflex visible" only shows that the heuristic always
  reports a bright spot (window or lamp reflections) while the model reports none. Reflex
  position error is not measurable on this batch, and the model has never seen a torch reflex.
- 12 crops from 2 people is far too few for conclusions. The default config (`batch_size = 64`,
  60 epochs) only takes one optimiser step per epoch on 49 crops and was under-trained (centre
  median 0.246); the run above was chosen to fix that, and both runs were scored on the same
  test split.

## Export

- Converted with `litert-torch` by `python -m keypoints.export` (see `ml/README.md`).
- Checked against PyTorch on 16 synthetic eye crops; the export fails if any output differs
  by more than 1e-4. Pilot run: largest difference 1.0e-6 (`reflex_y`); the file is 6.2 MB.
- iPhone 12 Pro Max, iOS 26.5, react-native-fast-tflite 3.0.1, Release build, 50 runs per eye
  crop after 5 warm-up runs: **CPU median 1.33 ms, p95 1.46 ms**. The CoreML delegate cannot
  load this model ("Failed to create TFLite interpreter"); the app already loads it on CPU
  (`useEyeModel`). Metal is not supported by fast-tflite.
- On the same phone, the 128 × 128 inputs the app's crop code produced were saved and run through
  the same file with LiteRT on a Mac: largest output difference 2.1e-7 (CPU delegate).

## Limitations

- The model only sees one eye crop. A bad crop (eye not centred, blur, glare) gives a bad
  measurement; frame quality checks (#5) must reject those frames first.
- Never trained or tested on a torch reflex, on children, or on the protocol distance, so it
  must not be used for the reflex offset until it is retrained on #29 captures.
- Labels come from one annotator; label noise is not measured yet.
- `TODO(#29)`: results on the cases that motivated the model (dark irises, eyelashes, partly
  closed lids), and any group where the error is clearly higher.
