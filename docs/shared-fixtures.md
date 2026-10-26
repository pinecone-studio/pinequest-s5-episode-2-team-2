# Shared fixtures (#21)

The measurement logic exists twice: in TypeScript (`packages/core`, used by the app) and in
Python (`ml/hirschberg`, used on recorded data). Both must give the same answer, or numbers
measured offline would not match what the phone shows. The JSON files in
`packages/core/fixtures/` hold inputs with the expected outputs, and both test suites read
them.

| Fixture          | TypeScript                                            | Python                                   | Covers                                               |
| ---------------- | ----------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| `geometry.json`  | `geometry.ts` (`geometryFixtures.test.ts`)            | `measure.py` (`test_geometry_parity.py`) | Reflex offset, mirrored asymmetry and its magnitude  |
| `quality.json`   | `quality.ts`, `pixels.ts` (`qualityFixtures.test.ts`) | `quality.py` (`test_quality.py`)         | Reason codes, head pose, crop sharpness and exposure |
| `aggregate.json` | `aggregate.ts` (`aggregateFixtures.test.ts`)          | `aggregate.py` (`test_aggregate.py`)     | Median score, spread, rejected-frame reasons         |
| `policy.json`    | `policy.ts` (`policyFixtures.test.ts`)                | `policy.py` (`test_policy.py`)           | Outcome and reasons, values exactly at the limits    |

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

## Not covered yet

The keypoint model itself: running the same eye crops through the exported model in Python and
on the phone, and comparing the outputs, needs the trained model on a device.
