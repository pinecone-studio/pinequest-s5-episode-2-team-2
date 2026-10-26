# Camera runtime validation — 2026-10-26

Refs #11. This is partial device evidence, not completion of the face pipeline.

## Device and launch

Physical iPhone 12 Pro Max (iPhone13,4), iOS 27.0.1 (24A446), Xcode 27.1
(27A9275), Debug Expo development build. The existing bundle identifier and
automatic development signing were retained. The generated `.xcworkspace` was
opened, the physical USB device selected, and Xcode's Run button used. Xcode
reported `Running mobile on Uuganaa`. Metro used `EXPO_PUBLIC_LANDMARK_DEBUG=1`.
USB/debug sessions disconnected during the session and were reconnected.

## Runtime regression and fix

Both pinned MediaPipe models loaded, but the original camera pipeline raised
`TypeError: Object is not a function` in the async worker. Imported worklet
functions were callable in the camera runtime but became objects when captured
again into the second worker runtime.

The worker closure is now created on RN. A synchronizable pending flag allows
only one native frame to wait for RN dispatch; busy frames are released. Resize,
detector, mesh and eye analysis remain on the worker. Native frames and resized
buffers are released on completion, rejected scheduling and teardown. Tests cover
the bounded RN queue, teardown before dispatch and dispatch failure/recovery.

After the fix, native no-face callbacks continued without that TypeError. Session
start alone no longer enables scanning: the preview-start event and loaded models
are also required, with stale native callbacks ignored after teardown.

## Observed checks and limits

- Camera denial showed the Settings recovery button (owner confirmed).
- Camera permission was enabled in Settings, then the app reopened.
- Native models loaded and no-face callbacks reported upright 2160 × 3840 frames.
- Preview remained black on both Device Hub and the physical phone (owner
  confirmed). A fresh Xcode Run reproduced it. Debugger inspection found an active
  preview connection, `isPreviewing=1`, an unhidden layer with opacity 1 and bounds
  380 × 320. These facts do not establish a usable preview.
- A temporary scalar-only resized-pixel probe found near-zero input values; no
  images were saved and the probe was removed. The black-feed cause remains under
  investigation. The owner also confirmed a black rear 1× preview in Apple's
  Camera app with lenses uncovered and pointed at a lit object. Device restart
  and retest are pending; a hardware fault has not been established.

One 60.026-second log sample contained 359 callbacks, all `faceCount=0`. Worker
latency median was **77.503 ms**, nearest-rank p95 **78.586 ms**. Timestamp span was
59,665.487 ms; `(359-1)/span` gave **6.000 Hz** (wall rate 5.981 callbacks/s).
This measures the no-face detector path on the black feed, not representative
face/mesh/eye inference or visible-preview performance. The build was launched
with Xcode Run; debugger attachment was not tracked for the entire sample. USB
power was present; temperature, battery percentage and Low Power Mode were not
independently recorded. Raw scalar logs stay in local validation artifacts.

No consented participant, approved 4K still, trained eye-keypoint weights or
approved recording was available. Face-following, eye-point alignment, portrait
coordinate verification, full pipeline latency/rate and native eye inference
remain untested. Cancel/background/tab/interruption/torch/retry device checks
also remain pending; unit tests do not replace them. Keep #11 open.
