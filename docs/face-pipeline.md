# Live landmarks (#11)

The face pipeline uses the CPU models verified in [the TFLite spike](spikes/tflite.md).
Weights are MediaPipe Face Landmarker v1 (Apache 2.0), downloaded from Google's pinned
bundle and checked against the spike's SHA-256. Weights stay ignored by git.

Install Python 3 and run `npm run models --workspace @app/mobile` once. Normal mobile
start/build/export commands run it automatically; subsequent runs use the verified local
cache offline. Rebuild the native app after installing the TFLite, worklets and resizer
dependencies; Expo Go cannot load them.

The resizer keeps the whole frame in a 512-pixel RGB square with black letterbox padding.
BlazeFace sees 128-pixel `[-1, 1]` RGB; the rotated 256-pixel face crop uses `[0, 1]` RGB.
Coordinates are mapped back to full-resolution pixels, and ambiguous multiple-face frames
never produce a usable landmark set. No image is logged, saved or uploaded.

Set `EXPO_PUBLIC_LANDMARK_DEBUG=1` in a development build to show the ten iris points and
log scalar per-frame latency/dimensions/face count. Camera frames are processed on an
AsyncRunner; busy frames are dropped, and the interval grows with measured processing
cost. Start waits for both the preview and the models. The scan result is still explicitly
a mock; live landmarks alone do not produce an assessment.

Set `EXPO_PUBLIC_MEASUREMENT_DEBUG=1` to draw the keypoint model's iris circle, iris centre and
reflex for each eye, with per-frame values (centre, radius, reflex offset, confidence, latency
and the reason when no eyes were measured). Both flags only work in development builds.

| Device          | Full pipeline median / p95 | Sustained rate | 4K point mapping |
| --------------- | -------------------------- | -------------- | ---------------- |
| Physical iPhone | Not measured               | Not measured   | Not checked      |

Pending physical-device validation: compare mapped points on an approved 4K still, verify
portrait rotation and eye positions, record per-frame latency and sustained rate on a real
iPhone, and recheck interruption/torch behaviour. Synthetic tests and a JS bundle cannot
establish those results. Keep #11 open until these checks pass.
