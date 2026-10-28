# Camera answers for the vision check (#254)

Practice, eye-cover readiness and the test offer an optional **Камераар хариулах** button.
It opens the front camera without audio capture. Touch answers remain available through
**Сумаар хариулах**, and appear automatically if permission, camera or model loading fails.
The practice keeps its existing correct/incorrect tones; the test stays silent.

The worker resizes the upright, unmirrored frame to a 512-square letterbox for pose inference.
It selects a visible raised wrist away from the eyes, samples a 256-square hand crop from
the native full-resolution NV12 planes, then runs palm and 21-point hand inference. Preview
mirroring is explicitly off. Gesture directions follow the person's view, as in the web demo.

The four checksum-pinned models load sequentially through a private AssetLoader. A bounded
model-only cache avoids reloading when changing eyes/stages. RN serialises use of the cached
interpreters across camera remounts; only one frame may await RN per camera. Busy/throttled
frames and resized buffers are released. No image, landmark or gesture history is saved.
Optional development logs contain only counts, gesture labels, timestamps and latency.

As in the web demo, a direction or open palm holds for at least 600 ms; a thumbs-up holds
for 800 ms on the cover screen. An initially held answer cannot submit until a fist or a
lowered hand rearms input (400 ms absent-hand observation). A thumb must drop once after
entering the cover screen. Missing body, a changed candidate, non-monotonic timestamps and
observation gaps over two seconds reset the hold. The two-second gap guard accommodates
the roughly one-second native callback cadence observed in the initial CPU check; it remains
a UI tuning limit, not a clinical threshold. The same pose cannot answer the next letter.

Round identities accompany worker results. Changing letter/stage discards old results;
disabling input, losing focus, backgrounding, interruption or unmount tears down capture
and suppresses late answers. A failed camera can be retried without losing touch controls.

## Limits and device checks

This adds camera answers to the existing test, without changing its screening policy. It
does not verify which eye is covered. Keep following the existing cover instructions.
Pose heatmap refinement, tracking and smoothing remain outside this implementation.
Physical 3 m reliability and thermal behavior must be recorded separately from unit tests.

On a consented participant, use Xcode Run with Device Hub closed. Check first that preview
stays visible; then verify each pointing direction, open palm, fist/release, two practice
answers and tones, thumbs-up readiness and a silent test. A held pose must submit once.
Switch to touch mode, background/foreground, interrupt and navigate away during a pending
frame: no stale answer may appear. Deny permission and verify touch fallback/retry.
Keep raw recordings, screenshots containing participants and model weights outside git.
