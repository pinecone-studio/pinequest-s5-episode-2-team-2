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
