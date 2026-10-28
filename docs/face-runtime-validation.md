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

## Fresh-install native build follow-up — 2026-10-27

Main runtime source `39dec2e`, the same Xcode/iPhone/Debug setup. After `npm ci`,
ExpoSQLite's generated `ios/sqlite3.h` was absent. `pod install` restores it from
the package's vendored sources. Without it, the compiler can resolve Apple's
system SQLite header and report missing `exsqlite3_*` functions.

Restoring the header alone and a clean build still failed in Swift's explicit
dependency scan: `_Builtin_stdarg` was needed but not provided while implicit
module use was disabled. The affected explicit ExpoSQLite PCM imported SDK
SQLite3 and lacked Expo's prefixed symbols. The project-specific caches were
backed up; no SDK, package source or dependency version was patched.

For this observed Xcode 27.1 failure, use the manual helper after native
preparation, with the CocoaPods Ruby environment active:

```sh
npm ci
# Generate the iOS project if absent, then refresh CocoaPods after npm ci:
cd apps/mobile/ios
pod install
cd ../../..
ruby scripts/configure_ios_swift_modules.rb
```

It sets `SWIFT_ENABLE_EXPLICIT_MODULES=NO` only on the generated `ExpoSQLite`
and `mobile` targets, leaves other targets untouched, and skips writes when
already configured. It validates both projects/targets before changing either.
Reapply after pod install/prebuild regenerates those projects. The setting
controls module build scheduling; see Apple's [build settings reference](https://developer.apple.com/documentation/xcode/build-settings-reference)
and React Native's [precompiled-build compatibility notes](https://reactnative.dev/blog/2025/08/12/react-native-0.81).

Xcode Run with this workaround passed native compilation and installation.
Launch was initially blocked by an untrusted Developer App certificate on the phone.
`codesign --verify --strict` passed, and the embedded development profile was
current, matched the existing Team and included the paired phone. The owner
subsequently completed Verify App using mobile data after Wi-Fi verification did
not complete. Xcode Run then launched the installed app successfully.
Release and Simulator builds have not been tested with it. This build setting
does not validate the camera, trained eye inference, live guidance or screening
thresholds. The runtime checkout was subsequently fast-forwarded to `b5a2504`
(#132/#133, unchanged native dependencies) for the visible-preview run below.

## Visible object preview and thermal stop — 2026-10-27

The physical device, OS, Xcode and Debug build setup above were retained. Xcode
reported `Running mobile on Uuganaa`. After selecting the refreshed Metro server
and opening Scan, the owner confirmed that the object preview was visible and
moving. The earlier black feed also affected Apple's Camera app; the owner
confirmed that Camera recovered after restarting the phone. The restart does not
establish the original cause.

Runtime source was main `b5a2504`, including #132/#133. Both MediaPipe models
loaded, and callbacks reported portrait 2160 × 3840 frames, all `faceCount=0`.
No human participant, face still or recording was captured. These measurements
cover the no-face detector path; face mesh and eye inference were not exercised.

| Sample                          | Callbacks | Camera timestamp span | Median worker latency | p95 worker latency | Analysis rate |
| ------------------------------- | --------: | --------------------: | --------------------: | -----------------: | ------------: |
| Initial collection              |       440 |              45.302 s |             45.075 ms |          46.907 ms |      9.691 Hz |
| Last 60 s before debugger pause |       201 |              59.834 s |            134.833 ms |         149.783 ms |      3.343 Hz |

p95 uses nearest rank; analysis rate is `(callbacks - 1) / timestamp span`.
The initial collection lasted 60.014 seconds of wall time but contained only
45.302 seconds of callback timestamps (7.332 callbacks/s by wall time). It is not
a full steady-state 60-second callback window. The later sample includes every
logged callback in the final 60 seconds of camera timestamps ending at
`177534620.397125` ms, before the diagnostic debugger pause; no latency-based
filter was applied. Its maximum callback gap was 333.468 ms. Neither rate measures
camera capture FPS or preview FPS.

After that window, LLDB read the public `NSProcessInfo` properties:
`thermalState=3` (critical), `lowPowerModeEnabled=0`. The process was resumed,
then stopped with Xcode Stop; the debug session ended. The owner subsequently
disconnected USB and confirmed that the phone was cooling with its screen off.
No additional thermal stress test was attempted. USB power and Device Hub viewing
were active during the run; initial thermal state, ambient temperature and device
temperature in degrees were not measured, so heat cannot be attributed solely to
the app or the two samples treated as a controlled thermal comparison.

The diagnostic debugger pause lasted about 49 seconds and produced a subsequent
49,684 ms callback plus dropped-frame messages. That callback is outside the
pre-pause timestamp window above; it is a debugger artifact, not steady-state
inference latency. Raw scalar logs and both sample summaries remain in local
validation artifacts; images and model weights are not committed.

Before another device run, let the phone cool and check its thermal baseline.
Face tracking, eye overlay alignment, approved 4K still mapping and representative
face/mesh/eye timings remain untested. Native cancel/background/tab/interruption,
torch and retry checks, and scan → measured result → saved history, also remain
pending. The previous permission-denial recovery observation is separate from
these checks. Keep #11 open; a moving no-face preview does not complete it.

The new model card (#135) reports pilot TFLite export `batch01-v2-bs16-e200`, but
its private artifact location and an app-container URI were not available on this
Mac or found through connected Drive search. No consented participant or approved
4K still was available for this session. The pilot contains no torch reflex and
must not be used for reflex offset until retrained on #29; its existence does not
establish native eye inference or complete #12/#13. The assigned annotation batch
and 20 independent double annotations for #34 are also still unavailable here.

The teammate's later #137 records a separate Release spike-app model parity and
latency check. It is useful model evidence, but does not exercise this app's Scan
camera path and is not counted as this session's native eye-crop acceptance.

## Live face tracking — 2026-10-28

Same iPhone 12 Pro Max (iOS 27.0.1), Xcode 27.1 Debug build launched with Xcode Run,
latest main `429a83a`, `EXPO_PUBLIC_LANDMARK_DEBUG=1`. Device Hub stayed closed; the
earlier black preview did not recur. The owner pointed the rear camera at their own face
and watched the screen in a mirror. No frame, still or screenshot of the face was saved.

The owner confirmed that the eye landmark overlay appeared on their face and followed it
live. Both MediaPipe models loaded; frames were 2160 × 3840 (and 3840 × 2160 once the phone
was turned).

| Start | Callbacks | With one face | Median worker latency (face) | p95 worker latency (face) |
| ----- | --------: | ------------: | ---------------------------: | ------------------------: |
| 11:12 |       390 |            73 |                    201.45 ms |                 221.61 ms |
| 11:57 |       546 |            50 |                    202.01 ms |                 229.30 ms |

No-face callbacks in the same runs had a median of about 45 ms, matching the earlier
initial collection. p95 uses nearest rank. Most callbacks had no face because the owner
was moving the phone and changing pose between checks; the share is not a detection-rate
measurement. Eye-keypoint weights were absent, so these timings cover face detection and
mesh only, not eye inference. The debugger was attached and USB power was present. The
thermal state was not read: an LLDB attach to a launch without Xcode ended the process.
The owner reported the phone cool and not warming. An attempt between the two
runs logged nothing: the app's JS had disconnected from Metro, and an Xcode Stop + Run
restored logging.

The "Done when" items for #11 now stand as follows. Live tracking on an iPhone is observed.
Per-frame latency with a face is reported above. Mapping to the full 4K frame on a still is
still unchecked: it needs a signed consent form (`docs/consent-form.md`) before any still
is taken. Keep #11 open until that check is done.
