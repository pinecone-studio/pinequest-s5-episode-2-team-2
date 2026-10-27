# Frame quality checks (#5)

Every scan frame is checked before its measurement is used. `assessQuality` in
`packages/core/src/quality.ts` returns the reasons; `ml/hirschberg/quality.py` is the Python
reference, and `packages/core/fixtures/quality.json` keeps the two in agreement. A frame with
any reason is dropped by `summarizeFrames`; the reasons of dropped frames reach the policy and
the live guidance.

All limits below are first guesses marked `TODO(tune)` in the code. None of them is a medical
threshold: they only decide whether a frame is usable.

## Checks and limits

Checks run in this order. The first three stop the check; the others are collected together.

| Reason             | Measured from                                             | Limit (`DEFAULT_QUALITY_CONFIG`)                                |
| ------------------ | --------------------------------------------------------- | --------------------------------------------------------------- |
| `NO_FACE`          | Face Landmarker face count                                | 0 faces                                                         |
| `MULTIPLE_FACES`   | Face Landmarker face count                                | more than 1 face                                                |
| `EYE_NOT_FOUND`    | Landmarks incomplete or not finite                        | fewer than 478 points                                           |
| `HEAD_TURNED`      | Roll, yaw and pitch from 2D landmarks                     | roll > 10°, yaw > 15° or pitch > 20°                            |
| `EYES_CLOSED`      | Lid gap / eye width (159–145, 386–374)                    | below 0.15 in either eye                                        |
| `NOT_LOOKING`      | Iris centre vs. middle of the eye corners, over eye width | both eyes beyond 0.03 to the same side                          |
| `EYE_NOT_FOUND`    | No eye measurement for the frame                          | —                                                               |
| `TOO_FAR`          | Mean iris radius / longer frame side                      | below 0.008                                                     |
| `TOO_CLOSE`        | Mean iris radius / longer frame side                      | above 0.02                                                      |
| `BLUR`             | Laplacian variance of the 128 px eye crop (0..1)          | below 0.0005 in either eye                                      |
| `TOO_DARK`         | Mean luminance of the eye crop                            | below 0.15 in either eye                                        |
| `OVEREXPOSED`      | Mean luminance and clipped fraction (≥ 0.98)              | mean above 0.85 or more than 10 % clipped; not after `TOO_DARK` |
| `REFLEX_NOT_FOUND` | Either eye has no reflex                                  | —                                                               |

`NOT_LOOKING` and `MULTIPLE_REFLEXES` are reserved and not produced yet.

## Why these values

- **Head pose** is approximate (no 3D model). The limits accept small natural movement of a
  child and reject a clearly turned or tilted head, where the reflex shifts for reasons other
  than eye alignment.
- **Eyes closed**: an open eye in the fixtures has a ratio of about 0.4; a blink drops it
  below 0.15.
- **Distance**: the iris limits correspond to roughly 50 cm and 20 cm with the iPhone main
  camera at 4K, around the 35 cm in the [capture protocol](capture-protocol.md).
- **Blur and exposure** use the same crop the model sees. The torch reflex itself is a few
  percent of the crop, so a small clipped area is expected; 10 % means the eye is washed out.

- **Looking away**: when both eyes look sideways both reflexes move the same way, and the
  mirrored asymmetry adds the two shifts up, so a few degrees off the camera already exceed the
  refer threshold. Only a shift of both irises to the same side is rejected; one eye off
  centre is what a squint looks like and must be kept.

## Tuning

Set the limits from recorded scans (#29) before the policy is validated:

1. Run the scans through the pipeline and keep the per-frame values (`headPose`, openness,
   iris fraction, `sharpness`, `exposure`, clipped fraction) with a manual usable/unusable
   label for a sample of frames.
2. For each check, pick the limit that drops most unusable frames while keeping most usable
   ones, and record the counts here.
3. Change the value in both `quality.ts` and `quality.py`, regenerate the expectations in
   `fixtures/quality.json` and keep both test suites green.
