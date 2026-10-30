# Camera answers for the vision check (#254)

Practice, eye-cover readiness and the test are answered with the front camera from the start,
without audio capture; camera permission is asked for when the test opens. There is no
toggle. As in the web demo, the arrow buttons, **Харагдахгүй байна** and **Бэлэн 👍** stay on
screen beside the camera, so a helper can answer too; when permission, camera or model
loading fails or capture pauses, a note and **Камерыг дахин нээх** appear. The practice keeps
its existing correct/incorrect voice; the test only says the neutral "next" cue.

## Same as the web demo (2026-10-30)

At the owner's request the E test follows the web demo (demo/web-poc `acuity.ts`) screen by
screen, keeping the app's voice cues:

- Practice and the cover screen show the web demo's three steps (👉 Заана, ✊ Атгана,
  ✋ Харагдахгүй бол); the test shows its hint line under the camera.
- The arrow (or **Харагдахгүй байна**) the camera is reading lights up, and the one it takes
  flashes for 250 ms.
- Eye cover, as the web demo's `coverChecker`: on cover and test frames the worker crops
  1.2 shoulder widths around the pose nose to 256 pixels. The scan's short-range face
  detector and face mesh give both irises, and the palm and hand models up to two hands; a
  hand point within 0.6 iris spacings of an eye covers it, and the pose eyes tell left from
  right. Without irises it falls back to the body model's hand points and eye visibility (a
  patch). Three equal readings change the shown state.
- The cover screen shows **Зөв нүд хаагдсан** / **Нөгөө нүдээ хаагаарай** / **Зөвхөн нэг
  нүдээ хаагаарай** / **Нүдээ хаагаарай**; the thumbs-up only counts while the other eye
  reads covered, or no body is in view (the person then decides).
- During the test, an eye read uncovered for a second pauses camera answers: the note
  **Нүд нээгдсэн байна. Нүдээ дахин хаагаад үргэлжлүүлээрэй.** shows above the letter and the
  hint shows ⏸ **Нүдээ хаана уу** until it reads covered again. Buttons keep working.

The six models load one after the other. The cover check adds the face and hand models to
cover and test frames, so readings there are slower than in practice; the device latency
still has to be measured. These limits are the web demo's TODO(tune) values, not validated
clinical thresholds.

The worker resizes the upright, unmirrored frame to a 512-square letterbox for pose inference.
It selects a visible raised wrist away from the eyes, samples a 256-square hand crop from
the native full-resolution NV12 planes, then runs palm and 21-point hand inference. The preview is mirrored as requested by the owner; the native frame output remains
unmirrored. Gesture directions follow the person's view, as in the web demo.

The pose, palm, hand, face and face-mesh models load sequentially through a private AssetLoader. A bounded
model-only cache avoids reloading when changing eyes/stages. RN serialises use of the cached
interpreters across camera remounts; only one frame may await RN per camera. Busy/throttled
frames and resized buffers are released. No image, landmark or gesture history is saved.
Optional development logs contain only counts, gesture labels, timestamps and latency.

Answers follow the web demo's loop (demo/web-poc `acuity.ts`), at the owner's request on
2026-10-30: close the hand (or lower it out of view for 400 ms) to arm, then point with the
index finger, or show an open palm for "can't see", and hold for 600 ms; after each answer the
hand closes again, so the same pose cannot answer the next letter. A thumbs-up held 800 ms on
the cover screen means ready, after the thumb has dropped once. The hint shows the web demo's
feedback: ✊ "Гараа атгана уу", 👉 "Хуруугаараа заана уу", the arrow with "Барина уу…",
✋ "Харагдахгүй" and ✓ "Бүртгэгдлээ". (Before, an open palm only rearmed and meant nothing.)
A changed candidate, non-monotonic timestamps and observation gaps over two seconds reset the
hold. The two-second gap guard is a UI tuning limit, not a clinical threshold.

As in the web demo, a body without a raised, free hand has no answer, and when the body model
finds no body at all (close to the phone it often finds none), the hand is looked for in the
whole frame. The next frame is taken as soon as the previous one is processed (before, the
interval was twice the processing time), so answers come about twice as fast.

Round identities accompany worker results. Changing letter/stage discards old results;
disabling input, losing focus, backgrounding, interruption or unmount tears down capture
and suppresses late answers. A failed camera can be retried without losing touch controls.
Thirty seconds without progressing to another letter/stage also pauses capture, preventing
unattended inference when recognition is not working. A new round renews that deadline.

## Limits and device checks

This adds camera answers to the existing test, without changing its screening policy. It
does not verify which eye is covered. Keep following the existing cover instructions.
Pose heatmap refinement, tracking and smoothing remain outside this implementation.
Physical 3 m reliability and thermal behavior must be recorded separately from unit tests.

On a consented participant, use Xcode Run with Device Hub closed. Check first that preview
stays visible; then verify each pointing direction, open-palm/release rearm, two practice
answers and tones, thumbs-up readiness and a silent test. A held pose must submit once.
Switch to touch mode, background/foreground, interrupt and navigate away during a pending
frame: no stale answer may appear. Deny permission and verify touch fallback/retry.
Keep raw recordings, screenshots containing participants and model weights outside git.

### Initial device follow-up (2026-10-28)

Xcode 27.1 Debug on iPhone 12 Pro Max / iOS 27.0.1, with Device Hub closed: initial
thermal state 0, Low Power Mode off. The owner confirmed consent. After a missing worklet
helper annotation was fixed, the owner confirmed a stable preview. A bounded inspector
sample contained 20 scalar frame records: all had a body, 17 had 21 hand points, and
directions 270/180 were observed. Worker latency median was 516.568 ms, p95 541.906 ms;
this is not a sustained benchmark. The roughly 1.06 s cadence exposed the one-second
hold reset, now widened to two seconds and regression-tested.

The owner still reported no submitted answer, and requested palm rearming and preview
mirroring. Those changes, the stable native output and idle timeout are implemented;
their physical acceptance remains pending. A later thermal reading was 2 (serious), so
the app was stopped through Xcode and the owner was asked to cool the phone. Do not
count landmarks alone as successful gesture input or claim reduced thermal load without
a repeat check. Keep #254 open for the remaining native matrix.

After cooling, a fresh Xcode Run read thermal state 0 before capture and again after the
first short test. The owner confirmed correct mirrored preview, practice gesture feedback
and audio, thumbs-up readiness, a silent test, background/foreground without a stale answer,
touch fallback, swipe-back teardown and Camera OFF → Settings → ON recovery. Scalar events
confirmed accepted 270/180 directions, then `ready`, then 0/90 directions. These observations
were at **close range**, as explicitly confirmed by the owner, and do not establish 3 m use.

A separate approximately 3 m attempt failed: body detections arrived but hand points stayed
at zero. The pose-index visibility gate could discard a region even with a visible wrist;
the crop now falls back to that wrist when the index is uncertain. Palm/hand models must
still independently confirm a hand. Debug-only crop/palm status counts distinguish a
missing region from rejected palm/hand inference, without logging landmark coordinates.
The revised 3 m check is pending; keep #254 open and do not claim distance reliability.

On 2026-10-30 two gates stricter than the web demo were removed: a pose point's visibility
also took the model's presence output (MediaPipe's PoseLandmarker, which the web demo uses,
reports the visibility output alone), and both shoulders had to be visible. Only the raised
wrist's visibility is checked now, as in the web demo.
