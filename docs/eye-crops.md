# Full-resolution eye crops (#12)

The mobile crop matches `ml/dataset/prelabel.py`: five iris radii, round-to-even pixel
coordinates and replicated borders, without rotating the eye. Both iris groups are sorted
by image x coordinate; `imageLeft` and `imageRight` do not mean anatomical left/right.

`cropPixels` accepts full-resolution RGB or iOS full-range, two-plane NV12 buffers with
their actual row strides. NV12 conversion matches VisionCamera 5.2.3's GPU resizer;
other YUV layouts/ranges must not be silently treated as NV12.

`inferEyes` sends two 128 × 128 RGB float32 `[0, 1]` tensors to the supplied trained
keypoint model. It validates the six exported values and returns frame-pixel positions,
the original crop transform, and reflex visibility. Invisible reflex coordinates are ignored.
Reflex visibility is not presented as a calibrated iris confidence.

The released trained `keypoints.tflite` is not available in this checkout. Model weights,
real eye data, physical-device colour/coordinate checks and latency measurements remain
required before this work can be called validated. No weights or images belong in git.

For device testing, copy the released model into the app's private Documents container and
set `EXPO_PUBLIC_KEYPOINT_MODEL_URI` to its file name (for example `keypoints.tflite`)
before starting Metro. The app resolves the name against its current Documents folder; iOS
can move that folder when Xcode reinstalls the app, so a copied `file://` path goes stale
(a full `file://` URI is still accepted). Names containing a path are rejected, and remote
model URLs are not accepted by this developer hook. The eye model loads only after both
face models have loaded: on an iPhone 12 Pro Max, loading all three at once handed the face
detector's bytes to the eye-model request and the face model failed to load. The hook validates the tensor contract
before publishing the model. Without weights, frame metadata reports `MODEL_UNAVAILABLE`;
the face preview remains usable and completed scans return `NOT_ASSESSED` with an explicit
[unvalidated-demo notice](real-scan-results.md).
