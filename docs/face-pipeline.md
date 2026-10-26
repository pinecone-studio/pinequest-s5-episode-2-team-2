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

Pending physical-device validation: compare mapped points on an approved 4K still, verify
portrait rotation and eye positions, record per-frame latency and sustained rate on a real
iPhone, and recheck interruption/torch behaviour. Synthetic tests and a JS bundle cannot
establish those results. Keep #11 open until these checks pass.
