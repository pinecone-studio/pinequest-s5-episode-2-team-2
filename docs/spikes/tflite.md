# TFLite face models spike (#16)

Status: preparation done, iPhone measurements pending. Model shapes, preprocessing and
decoding are verified on a Mac against MediaPipe. The app builds for iOS in Release with Xcode
27.1 (unsigned, generic device); it has not run on an iPhone yet.

## Question and setup

Can MediaPipe's face detector and face landmark models run on an iPhone through
`react-native-fast-tflite`, and how fast are they on CPU versus the CoreML delegate?

The throwaway app is kept outside this repository, as requested in the issue. Its baseline is
Expo SDK 58 / React Native 0.88 (the same as `apps/mobile`), react-native-fast-tflite 3.0.1 (Nitro Modules 0.37) and
@shopify/react-native-skia 2.14 for image decoding, cropping and drawing. Skia is used only
because the spike needs pixels from a still image; the live camera path is a separate issue.
CocoaPods resolves TensorFlowLiteC 2.17.0 with the CoreML subspec. `expo-doctor` flags
fast-tflite as "untested on New Architecture" in React Native Directory; v3 is built on Nitro
Modules and the Release build compiles, but this is only confirmed once it runs on a device.

## Models

Both come from the Face Landmarker bundle, which is a zip:

```bash
curl -L -o face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
unzip face_landmarker.task
```

SHA-256 of the `.task` file: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.
The bundle also contains `face_blendshapes.tflite`, which we do not need.

| File                             | Model                                   | Size   | License    |
| -------------------------------- | --------------------------------------- | ------ | ---------- |
| `face_detector.tflite`           | BlazeFace short range                   | 230 KB | Apache 2.0 |
| `face_landmarks_detector.tflite` | Face Mesh V2 (478 landmarks incl. iris) | 2.6 MB | Apache 2.0 |

Licenses are taken from the model cards linked under Sources. The weights are float16 stored,
float32 at the tensor boundary. No `.tflite` or `.task` file is committed.

## Tensors

Read with the LiteRT interpreter and the embedded TFLite metadata.

| Model     | Tensor           | Shape              | Type    | Meaning                                  |
| --------- | ---------------- | ------------------ | ------- | ---------------------------------------- |
| Detector  | `input`          | `[1, 128, 128, 3]` | float32 | RGB, `(v - 127.5) / 127.5` → `[-1, 1]`   |
| Detector  | `regressors`     | `[1, 896, 16]`     | float32 | Per anchor: box (4) + 6 keypoints (x, y) |
| Detector  | `classificators` | `[1, 896, 1]`      | float32 | Per anchor score logit                   |
| Landmarks | `input_12`       | `[1, 256, 256, 3]` | float32 | RGB face crop, `v / 255` → `[0, 1]`      |
| Landmarks | `Identity`       | `[1, 1, 1, 1434]`  | float32 | 478 × (x, y, z) in crop pixels           |
| Landmarks | `Identity_1`     | `[1, 1, 1, 1]`     | float32 | Face presence logit                      |
| Landmarks | `Identity_2`     | `[1, 1]`           | float32 | Tongue-out score (unused)                |

## Preprocessing and decoding

Detector (parameters from MediaPipe's `face_detector_graph.cc`):

1. Letterbox the image into 128 × 128: scale by `128 / max(w, h)`, centre, pad with black.
2. Anchors: strides 8, 16, 16, 16, fixed size, 2 anchors per cell on the 16 × 16 grid and 6 per
   cell on the 8 × 8 grid (512 + 384 = 896). Anchor centre is `((x + 0.5) / n, (y + 0.5) / n)`.
3. Per anchor: `cx = r[0] / 128 + ax`, `cy = r[1] / 128 + ay`, `w = r[2] / 128`,
   `h = r[3] / 128`; keypoint `k` is `r[4 + 2k] / 128 + ax`, `r[5 + 2k] / 128 + ay`.
4. Score is `sigmoid(clip(logit, ±100))`, threshold 0.5, then weighted NMS at IoU 0.3.
5. Undo the letterbox to get image pixels. Keypoints 0 and 1 are the eyes.

Landmark crop:

1. Rotation `= -atan2(-(y1 - y0), x1 - x0)` from keypoint 0 to 1, so the eyes end up level.
2. Centre on the box centre, size = 1.5 × the box's long side.
3. Warp that rotated square to 256 × 256 (bilinear) and normalize to `[0, 1]`.
4. Output `(u, v)` maps back with `centre + R(rotation) · ((u, v) / 256 − 0.5) · size`.
   `sigmoid(Identity_1)` is the face presence probability.

Iris landmarks are `468–472` (centre, then four boundary points) and `473–477` for the other
eye, the same indices `ml/hirschberg/cli.py` uses.

## Desktop verification

On the MediaPipe test portrait (820 × 1024), the spike's TypeScript decoding, fed the raw outputs
from the LiteRT interpreter, matched MediaPipe's own `FaceDetector` and `FaceLandmarker`:
detection box within 0.7 px, all 478 landmarks within 0.1 px, presence logit 14.8.
For reference only, Mac CPU (Apple M3, LiteRT, 50 runs): detector median 1.3 ms,
landmarks 3.6 ms. These are not iPhone numbers.

## Procedure on the iPhone

1. Install Xcode and CocoaPods, connect an iPhone in developer mode.
2. In the spike app: `npm install`, then
   `npx expo run:ios --device --configuration Release`.
3. The app runs detection, crop and landmarks on the bundled image on CPU and draws the
   landmarks, then times 50 runs of each model with CPU, CoreML and Metal after 5 warm-up runs.
   Only `runSync` is timed; Skia preprocessing is reported separately.
4. Copy the `SPIKE_RESULT` log line into the issue and fill in the table below. Record iPhone
   model, iOS version, battery / Low Power Mode and whether the phone was warm.

## Results

| iPhone / iOS | Model     | Delegate | Median (ms)  | p95 (ms)     |
| ------------ | --------- | -------- | ------------ | ------------ |
| Pending      | Detector  | CPU      | Not measured | Not measured |
| Pending      | Detector  | CoreML   | Not measured | Not measured |
| Pending      | Landmarks | CPU      | Not measured | Not measured |
| Pending      | Landmarks | CoreML   | Not measured | Not measured |

| Check                                        | Result       |
| -------------------------------------------- | ------------ |
| App builds for iOS (Release, unsigned)       | Passed       |
| Both models load with CPU                    | Not verified |
| Both models load with CoreML delegate        | Not verified |
| Landmarks on device match the desktop result | Not verified |
| Preprocessing time (Skia, CPU)               | Not measured |

## Decision and possible fallback

No recommendation yet. If the CoreML delegate fails to load or is slower, use CPU (or try
the Metal delegate, which the app also times). If fast-tflite does not build with the current
Expo / React Native, try fast-tflite 2.x on an SDK it supports, or MediaPipe's native iOS
Face Landmarker through an Expo module.

## Sources

- [Issue #16](https://github.com/pinecone-studio/pinequest-s5-episode-2-team-2/issues/16)
- [react-native-fast-tflite](https://github.com/mrousavy/react-native-fast-tflite)
- [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
- [BlazeFace short range model card](<https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf>)
- [Face Mesh V2 model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf)
- [face_detector_graph.cc](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/face_detector/face_detector_graph.cc)
