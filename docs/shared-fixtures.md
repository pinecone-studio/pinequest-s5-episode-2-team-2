# Shared fixtures (#21)

The measurement logic exists twice: in TypeScript (`packages/core`, used by the app) and in
Python (`ml/hirschberg`, used on recorded data). Both must give the same answer, or numbers
measured offline would not match what the phone shows. The JSON files in
`packages/core/fixtures/` hold inputs with the expected outputs, and both test suites read
them.

| Fixture          | TypeScript                                             | Python                                                         | Covers                                                |
| ---------------- | ------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------- |
| `geometry.json`  | `geometry.ts` (`geometryFixtures.test.ts`)             | `measure.py` (`test_geometry_parity.py`)                       | Reflex offset, mirrored asymmetry and its magnitude   |
| `quality.json`   | `quality.ts`, `pixels.ts` (`qualityFixtures.test.ts`)  | `quality.py` (`test_quality.py`)                               | Reason codes, head pose, crop sharpness and exposure  |
| `aggregate.json` | `aggregate.ts` (`aggregateFixtures.test.ts`)           | `aggregate.py` (`test_aggregate.py`)                           | Median score, spread, rejected-frame reasons          |
| `policy.json`    | `policy.ts` (`policyFixtures.test.ts`)                 | `policy.py` (`test_policy.py`)                                 | Outcome and reasons, values exactly at the limits     |
| `eyeCrop.json`   | `eyeCrops.ts`, `pixels.ts` (`eyeCropFixtures.test.ts`) | `prelabel.py`, `keypoints/data.py` (`test_eye_crop_parity.py`) | Eye crop position and size, the 128 × 128 model input |

Tolerances: 1e-9 for geometry, 1e-6 for the other values (the expectations are rounded to six
decimals). Reason codes and outcomes must match exactly, including order.

## Changing the logic

1. Change the TypeScript and the Python code in the same PR.
2. If an expected value changes on purpose, update it in the fixture and say why in the PR.
   The expectations were produced by the TypeScript code; never edit them only to make the
   Python side pass.
3. Run both suites: `npm test` from the repository root and `uv run pytest` from `ml/`.

The thresholds in `policy.json` are test values, not the app's demo thresholds. JSON has no
NaN, so `aggregate.json` writes a non-finite measurement as `null` in an asymmetry component.

`eyeCrop.json` lives in `apps/mobile/src/features/measurement/fixtures/` because the crop code
is in the app, not in `packages/core`. It is written by `npx tsx scripts/make_eye_crop_fixture.ts`
from a synthetic frame that both sides build from the same formula, so no image is stored. The
crop position and size must match exactly; the model input may differ by two grey levels, because
OpenCV resizes 8-bit images in fixed point and rounds (measured: under one grey level).

## Keypoint model on the phone

The model itself is checked by hand, not by a test suite, because it needs a trained model and a
phone. With the pilot model (`docs/model-card.md`), on an iPhone 12 Pro Max with
react-native-fast-tflite on CPU: the 128 × 128 inputs produced by the app's crop code were saved
on the phone and run through the same `keypoints.tflite` with LiteRT on a Mac. The largest output
difference was 2.1e-7. Together with `eyeCrop.json` (input) and `keypoints.export` (TFLite vs
PyTorch), the chain from frame to model output matches between the app and the training code.

Repeat this check for every released model. It was run with the TFLite spike app, which copies
the app's `eyeRegions` and RGB `cropPixels`, not with the scan screen itself.
