# Camera capture spike (#9)

Status: native preparation validated. iOS project generation, the JavaScript
bundle and an unsigned arm64 Release build pass on a Mac. Signed installation
and physical-device measurements are still pending. This document does not
establish camera or clinical feasibility.

The earlier Windows preparation used Node 24.15.0; Expo skipped native iOS
generation there. On 2026-10-22 the separate spike was recreated on macOS with
Node 24.19.0 and Xcode 27.1. TypeScript, lint, five frame-counter tests, iOS
Metro/Hermes export and `expo prebuild --platform ios --no-install` pass.
The counter tests cover steady 30 FPS, delivery gaps, a sustained drop to 15 FPS,
dimension/rotation validation, invalid timestamps and unexpected pixel formats.
Repository format, lint, typecheck, all 49 tests and iOS Metro/Hermes export also
pass on Node 24.19.0.

## Question and setup

Can an iPhone deliver 3840 x 2160 frames to an empty frame processor with the
back-camera torch on for 60 seconds at a usable rate, compared with 1920 x 1080?

The throwaway app is kept outside this repository, as requested in issue #9.
Its reproducible baseline is Expo SDK 53 / React Native 0.79.6,
react-native-vision-camera 4.7.3 and react-native-worklets-core 1.6.3. This
matches the issue's V4 API; V5 uses different APIs. Native compilation passes;
runtime compatibility is unverified. The V4 worklets Babel plugin requires the
optional-chaining, nullish-coalescing and template-literals Babel plugins in
this standalone app. Do not change the production app's versions based on this
preparation.

On this Mac, CocoaPods 1.16.2 installed the native dependencies with frame
processors enabled and location APIs disabled. The first Release compilation
hit the known fmt 11.0.2/modern AppleClang consteval error. The standalone spike
includes an idempotent, version-checked `patch:fmt` script that disables fmt's
consteval branch for AppleClang in its local Pods header. It must be rerun after
a fresh pod installation. This workaround does not modify this repository or
its production dependencies. With this patch, `xcodebuild` of the
`Kamerynturshilt` scheme, Release configuration, generic iOS destination and
`CODE_SIGNING_ALLOWED=NO` succeeds, including VisionCamera and worklets.
`expo install --check` also reports compatible dependencies. An unsigned build
cannot be installed as a normal development app on the physical iPhone.

Request the wide-angle back camera, exact 4K or 1080p video dimensions, 30 FPS,
torch on, YUV, HDR off, buffer compression off and stabilization off. Reject
unsupported exact dimensions or observed dimensions that differ from the request
(portrait rotation of the same dimensions is accepted and logged as delivered).
Log only scalar metadata, never pixels, device identifiers or media paths.

The connected device is an iPhone 12 Pro Max (iPhone13,4), iOS 27.0.1. USB pairing
and Developer Mode are confirmed. A valid Apple Development signing identity
has not yet been configured, so connection alone is not a successful app run.
The standalone bundle identifier is `mn.pinequest.cameraspike.uugana`; it is
separate from the production app. Open `ios/Kamerynturshilt.xcworkspace`, set the
development team and use the Release configuration for the measurements.

## Procedure

1. The standalone controls and camera permission copy are in Mongolian. Review
   them with the team before participant testing.
2. On a Mac with Xcode, install the spike dependencies, prebuild iOS, and build
   to a real iPhone. Expo Go and a simulator cannot answer this question.
3. Use an object for performance testing. Before any human capture, read the
   [capture protocol](../capture-protocol.md) and obtain the signed consent
   required by CONTRIBUTING.md and the protocol owner. The consent and
   calibration documents are now present in `docs/`.
4. Record model, iOS, build mode, ambient light, battery/Low Power Mode and
   thermal observations. Use a Release build and matching conditions for both
   resolutions. Start with a cool, unplugged phone; cool between runs.
5. Run 4K for 60 seconds from the first frame. Count frames in the worklet and
   publish metadata about once per second. Record actual width, height, pixel
   format, initial FPS and final FPS. Repeat at 1080p.
6. Initial FPS is the first complete roughly one-second window. Final FPS is
   the latest completed window when elapsed frame time reaches 60 seconds.
   Include delivery gaps in the rate. V4.7.3 iOS frame timestamps are milliseconds.
7. Invalidate interrupted runs, camera errors, dimension/pixel-format mismatch,
   or the 65-second wall-clock watchdog. Confirm the torch stops on completion,
   manual stop, error, backgrounding and navigation away.
8. Follow the protocol owner's approved workflow for three consenting adult
   reference photos at about 35 cm. Review reflex visibility in both eyes. Keep
   photos only in the private team Drive. A separate still-photo check does not
   establish visibility in the live YUV stream; record that distinction.

## Results

| iPhone / iOS               | Requested resolution | Actual dimensions | FPS, initial | FPS, after 60 s | Pixel format | Thermal observation |
| -------------------------- | -------------------- | ----------------- | ------------ | --------------- | ------------ | ------------------- |
| iPhone 12 Pro Max / 27.0.1 | 3840 x 2160          | Not measured      | Not measured | Not measured    | Not measured | Not measured        |
| iPhone 12 Pro Max / 27.0.1 | 1920 x 1080          | Not measured      | Not measured | Not measured    | Not measured | Not measured        |

| Required check                                                 | Result                                    |
| -------------------------------------------------------------- | ----------------------------------------- |
| Torch bright enough at about 35 cm                             | Not assessed                              |
| Reflex visible in both eyes in three approved reference photos | Not assessed                              |
| Reflex visible in live processor frames                        | Not assessed                              |
| HDR disabled on device                                         | Requested in code; not verified on device |
| Stabilization disabled on device                               | Requested in code; not verified on device |
| Torch stops on all exit paths                                  | Not verified on device                    |
| Empty processor throughput versus real ML throughput           | ML throughput not measured by this spike  |

## Decision and possible fallback

No resolution recommendation yet. If 4K cannot maintain a useful measured rate,
test 1080p under the same conditions. A closer distance is only a proposed
follow-up for the protocol owner to approve and validate; it is not established
as a suitable capture distance. Do not conclude that an empty frame processor
proves the later model can meet its frame budget.

## Sources

- [Issue #9](https://github.com/pinecone-studio/pinequest-s5-episode-2-team-2/issues/9)
- [VisionCamera V4 formats](https://github.com/margelo/react-native-vision-camera/blob/v4.7.3/docs/docs/guides/FORMATS.mdx)
- [VisionCamera V4 frame processors](https://github.com/margelo/react-native-vision-camera/blob/v4.7.3/docs/docs/guides/FRAME_PROCESSORS.mdx)
- [VisionCamera V4 iOS timestamps](https://github.com/margelo/react-native-vision-camera/blob/v4.7.3/package/ios/FrameProcessors/Frame.m)
- [Expo native builds](https://docs.expo.dev/develop/development-builds/create-a-build/)
- [fmt 11.0.2 AppleClang compatibility issue](https://github.com/fmtlib/fmt/issues/4740)
