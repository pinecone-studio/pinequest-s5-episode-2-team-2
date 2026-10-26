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

## Mac verification — 2026-10-26

Fresh main checkout `77bc97b`, macOS arm64, Node 22.23.4, Python 3.11.17 in a new
root `.venv`, CocoaPods 1.16.2 and Xcode 27.1 (`27A9275`). The connected device was
an iPhone 12 Pro Max (`iPhone13,4`), iOS 27.0.1 (`24A446`), paired over USB with
Developer Mode enabled. These details identify the test environment, not a passed
physical-device test.

`npm ci`, typecheck, 189 JS tests (145 mobile / 44 core), three Python model-bundle
tests and the iOS Metro/Hermes export passed. The new `.venv` exposed a lint setup
bug: ESLint scanned pip's vendored browser worker and reported two `self` errors.
Ignoring Python environment directories fixes that failure; lint and format checks
then passed. No installed dependencies or application code were changed for this fix.

`npm run mobile:ios` prepared the MediaPipe models, generated the native project
and installed the pods. The existing development Team and automatic signing were
set only in the ignored generated project; the bundle identifier remains
`studio.pinecone.pinequest.team2`.

Xcode's Run action was invoked with the `mobile` scheme and physical iPhone
selected. It stopped before compilation with “Download Xcode support for Metal
Toolchain?”. Installing the official Metal Toolchain (`27A266a`) resolved that
missing-component error. The subsequent generic iOS arm64 Debug build passed:

```sh
xcodebuild -workspace apps/mobile/ios/mobile.xcworkspace -scheme mobile \
  -configuration Debug -destination "generic/platform=iOS" \
  -allowProvisioningUpdates build
```

The app was signed with the existing Apple Development identity and matching team
provisioning profile. `codesign --verify --strict` passed for the built app. This
command-line build does not establish a successful Xcode Run on a physical iPhone.

The first session ended after the iPhone became unavailable. After reconnecting,
Signing & Capabilities was checked in Xcode: automatic signing enabled, the existing
Personal Team and managed profile selected, and the original bundle identifier.
The Xcode Run button was clicked with `Uuganaa` selected. After the owner unlocked
the phone, Xcode reported “Running mobile on Uuganaa”; the installed app connected
to Metro and loaded onboarding on the physical device. The camera permission
prompt also appeared. This establishes native build, installation and initial JS
startup, not the face pipeline acceptance criteria.

Runtime model loading, live face tracking, 4K still mapping, portrait/preview
alignment, permission recovery, cancel, interruption, background/tab transitions,
torch behaviour and retry remain pending. Full-pipeline median, p95 and sustained
analysis rate remain **not measured**. #11 still requires this evidence even if its
GitHub state has been closed based on merged implementation PRs.
