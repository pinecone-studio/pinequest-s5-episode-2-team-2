# Camera capture spike (#9)

Status: preparation only. No iPhone build or physical-device measurement has
been performed. This document does not establish camera or clinical feasibility.

Preparation checks on Windows / Node 24.15.0: spike TypeScript and lint checks,
three frame-counter tests and an iOS Metro/Hermes export passed. Expo skipped
iOS native project generation on Windows; native build and measurements remain
pending. Repository format, lint, typecheck and all 16 tests also passed.

## Question and setup

Can an iPhone deliver 3840 x 2160 frames to an empty frame processor with the
back-camera torch on for 60 seconds at a usable rate, compared with 1920 x 1080?

The throwaway app is kept outside this repository, as requested in issue #9.
Its reproducible baseline is Expo SDK 53 / React Native 0.79.6,
react-native-vision-camera 4.7.3 and react-native-worklets-core 1.6.3. This
matches the issue's V4 API; current V5 docs describe different APIs. Native
compatibility is pending an Xcode build. Do not change the production app's
versions based on this preparation.

Request the wide-angle back camera, exact 4K or 1080p video dimensions, 30 FPS,
torch on, YUV, HDR off, buffer compression off and stabilization off. Reject
unsupported exact dimensions or observed frame dimensions that differ from the
request. Log only scalar metadata, never pixels or media paths.

## Procedure

1. Have the team supply Mongolian `TODO(copy)` labels and camera permission copy.
2. On a Mac with Xcode, install the spike dependencies, prebuild iOS, and build
   to a real iPhone. Expo Go and a simulator cannot answer this question.
3. Use an object for performance testing. Before any human capture, read the
   [capture protocol](../capture-protocol.md) and obtain the signed consent
   required by CONTRIBUTING.md and the protocol owner. Wait for the referenced
   consent and calibration documents if they are not yet available.
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

| iPhone / iOS | Requested resolution | Actual dimensions | FPS, initial | FPS, after 60 s | Pixel format | Thermal observation |
| ------------ | -------------------- | ----------------- | ------------ | --------------- | ------------ | ------------------- |
| Pending      | 3840 x 2160          | Not measured      | Not measured | Not measured    | Not measured | Not measured        |
| Pending      | 1920 x 1080          | Not measured      | Not measured | Not measured    | Not measured | Not measured        |

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
- [VisionCamera V4 formats](https://github.com/mrousavy/react-native-vision-camera/blob/v4.7.3/docs/docs/guides/FORMATS.mdx)
- [VisionCamera V4 frame processors](https://github.com/mrousavy/react-native-vision-camera/blob/v4.7.3/docs/docs/guides/FRAME_PROCESSORS.mdx)
- [VisionCamera V4 iOS timestamps](https://github.com/mrousavy/react-native-vision-camera/blob/v4.7.3/ios/FrameProcessors/Frame.m)
- [Expo native builds](https://docs.expo.dev/develop/development-builds/create-a-build/)
