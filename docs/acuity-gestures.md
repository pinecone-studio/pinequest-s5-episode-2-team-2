# Camera answers for the vision check (#254)

Practice, eye-cover readiness and the test offer an optional **Камераар хариулах** button.
It opens the front camera without audio capture. Touch answers remain available through
**Сумаар хариулах**, and appear automatically if permission, camera or model loading fails.
The practice keeps its existing correct/incorrect tones; the test stays silent.

The worker resizes the upright, unmirrored frame to a 512-square letterbox for pose inference.
It selects a visible raised wrist away from the eyes, samples a 256-square hand crop from
the native full-resolution NV12 planes, then runs palm and 21-point hand inference. The preview is mirrored as requested by the owner; the native frame output remains
unmirrored. Gesture directions follow the person's view, as in the web demo.

The four checksum-pinned models load sequentially through a private AssetLoader. A bounded
model-only cache avoids reloading when changing eyes/stages. RN serialises use of the cached
interpreters across camera remounts; only one frame may await RN per camera. Busy/throttled
frames and resized buffers are released. No image, landmark or gesture history is saved.
Optional development logs contain only counts, gesture labels, timestamps and latency.

A pointing direction holds for at least 600 ms; a thumbs-up holds
for 800 ms on the cover screen. An initially held answer cannot submit until an open palm or a
lowered hand rearms input (400 ms absent-hand observation). A thumb must drop once after
entering the cover screen. Missing body, a changed candidate, non-monotonic timestamps and
observation gaps over two seconds reset the hold. The two-second gap guard accommodates
the roughly one-second native callback cadence observed in the initial CPU check; it remains
a UI tuning limit, not a clinical threshold. The same pose cannot answer the next letter. At the owner's request, an open palm is neutral
and does not mean cannot-see; the cannot-see button is always available in the test.

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
