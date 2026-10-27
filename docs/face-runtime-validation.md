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
Launch was then blocked by an untrusted Developer App certificate on the phone;
the owner must complete the device's Trust step before preview/result checks.
`codesign --verify --strict` passed, and the embedded development profile was
current, matched the existing Team and included the paired phone. Device-side
Verify App has not yet completed; local signature validity does not establish
device trust.
Release and Simulator builds have not been tested with it. This build setting
does not validate the camera, trained eye inference, live guidance or screening
thresholds. The runtime checkout was subsequently fast-forwarded to `b5a2504`
(#132/#133, unchanged native dependencies) for the next launch.
