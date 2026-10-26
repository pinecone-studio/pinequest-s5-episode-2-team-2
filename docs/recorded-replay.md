# Developer replay (#15)

In a development native build, open Profile → `TODO(copy): Бичлэг дахин тоглуулах`.
Choose a local folder containing `scan.json` and tightly packed, upright RGB24 `.rgb`
frames. The production route redirects to Scan. The normal consent gate still applies.

```json
{
  "version": 1,
  "width": 3840,
  "height": 2160,
  "frames": [
    { "file": "frame0001.rgb", "timestampMs": 0 },
    { "file": "frame0002.rgb", "timestampMs": 100 }
  ]
}
```

Every file must contain exactly `width × height × 3` bytes (RGB, no header or padding).
Use approved private recordings only. Frames must have the same dimensions, at most
3840 pixels per axis and 4K total pixels, with 1–90 unique files and strictly increasing
timestamps from 0 through 3000 ms. Paths, URLs and nested filenames are rejected.
RGB/NV12 recordings are ignored by git; never commit them or participant metadata.

Replay loads one frame at a time and runs the same face decoder, landmark model and
full-resolution eye model/crop transforms as the camera. It preserves recording timestamps;
processing can run slower than capture on a slow device. Cancel, backgrounding and leaving
the screen suppress pending results and clear replay timers. No input is uploaded or copied.
An already-running native inference may finish after cancel; its result is ignored.

The released eye model is optional for face-only debugging; see [eye-crops.md](eye-crops.md).
Missing weights remain `MODEL_UNAVAILABLE`. Quality integration, trained weights, approved
real recordings and physical iPhone replay checks are still pending. This developer screen
shows processing metadata and guidance, never a clinical assessment.
