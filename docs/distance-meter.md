# Phone-to-person distance (#259)

The optional setup before `/acuity` reads native depth associated with exactly one current
face. It displays approximate metres and the existing 3 m setup target. It does not change
optotype sizes, decision thresholds or save a distance with a clinical result. The distance
camera unmounts before the test screen can open its camera. The existing gesture-enabled test screen is preserved from main (PR #258).

No adult IPD, assumed shoulder width or guessed focal length is used. AVDepthData distinguishes
absolute/relative accuracy and quality; only current absolute/high-quality depth is accepted.
Disparity/half-depth is converted natively to float32 depth in metres when supported. The
camera-space face centre and bounds are mapped with the depth API rather than preview maths.
A full 3x3 patch must fit inside the face bounds; at least five finite positive samples are
needed for its median. Below-display-resolution readings are hidden instead of showing0.0m.

Face targets and displayed readings expire after750ms. Missing/multiple faces, unsupported
formats/hardware, low-quality data, invalid pixels, backgrounding and navigation clear the
number. Depth buffers, converted frames and metadata objects are released. Stable output
configuration avoids recreating camera threads on UI updates. Capture stops after30s and
can be reopened. Only scalar diagnostics are available behind the existing development flag;
images, depth maps and face coordinates are not saved, uploaded or logged.

The front TrueDepth camera is preferred. The owner’s reference is reflected in a small
mirrored preview, large amber/green guidance card, approximate metres and manual start button.
Guidance follows the displayed tenth around the existing 3 m target; it is not an accuracy
claim or clinical acceptance threshold. “Дахин шалгах” restarts capture, not screen calibration.
Hardware/range support and accuracy must be verified on the actual device. A native quality
flag is not a calibrated error bound. Never claim validated3m placement from unit tests.
Manual continuation remains available if the sensor cannot measure at the required range.

Device acceptance: Xcode Run on the USB iPhone, Device Hub off. Check no-person/multiple-person
and stale-reading behavior, permission denial/recovery, background/navigation and retry. Compare the displayed distance with a physical tape/ruler at known distances,
including approximately0.5m,1m and3m; record the actual errors and unsupported ranges. Do not
store participant previews or depth maps.

On 2026-10-29, Xcode Run on the USB iPhone 12 Pro Max returned absolute/high-quality depth
readings; the owner confirmed the small preview, approximate metres and placement guidance
appeared. No-face callbacks returned null. Back returned to Home, as expected for this route.
The owner currently has no tape/ruler. Known-distance accuracy, approximately 3 m range,
on-screen stale-number clearing, continuation and remaining lifecycle acceptance are pending.

Primary references: [AVDepthData](https://developer.apple.com/documentation/avfoundation/avdepthdata),
[depth accuracy](https://developer.apple.com/documentation/avfoundation/avdepthdata/depthdataaccuracy),
[LiDAR capture](https://developer.apple.com/documentation/avfoundation/capturing-depth-using-the-lidar-camera).

## Display stability and ready cue

A bounded, in-memory window needs at least three coherent samples over 400 ms before showing
metres. It uses their median and a small rounding dead band to reduce tenth-place flicker.
A large jump hides the old value until new samples agree. Invalid data, gaps, stale/queued
samples, backgrounding and retry reset the filter. Face-loss metadata clears the number
immediately; an acquisition/loss generation rejects older queued depth replies.

The green state requires one continuous second of fresh samples rounding to the existing
3.0 m target. A short local tone plays once per capture attempt; retry rearms it. Loss of
readiness/background/unmount cancels pending audio. Manual continuation is always available,
including when audio fails. These time/noise limits are UI behaviour, not calibrated error
bounds or clinical tolerances. No screening thresholds or optotype sizes change.

Regression tests cover jitter, isolated spikes, real movement, stale and non-monotonic
samples, target-hold reset, face-loss races, cue repetition/cancellation and audio failure.
A fresh Xcode Run on 2026-10-29 started at thermal state 0. The owner confirmed the revised
number was stable at close range and disappeared when their face left the camera. An
approximately 3 m attempt failed: valid face targets were lost and the display returned to
its unknown state. No ready event was recorded, so the green/tone native check remains
unverified. The debug session later showed Finished running; no post-check thermal reading
was obtained. Known-distance accuracy still needs a physical reference.

The owner approved clearer waiting/unknown copy on 2026-10-29: “Зай хэмжиж байна…” while
acquiring a stable value; after three seconds without a stable value, “Зайг тогтвортой
хэмжиж чадсангүй”. Retry/background resets this wait, and valid readings restore placement
guidance. These captions distinguish lost measurement from navigation; they do not repair
the failed approximately 3 m recognition.

## Full-range face acquisition

The distance camera now obtains its target from MediaPipe's full-range sparse detector
instead of AVFoundation face metadata, which lost valid targets in the approximate 3 m
attempt. The reference graph specifies float32 192×192 RGB in [-1, 1], 2304 stride-4 anchors
and a 0.6 confidence cutoff. The existing short-range landmark/eye pipeline is unchanged.
The full-range model is checksum-pinned and prepared locally; no weights enter git.

Inference uses one cached interpreter, a bounded single-frame handoff and a worker at
approximately 3 Hz or slower when inference is expensive. Full-frame letterboxing is undone
before all four face-box corners are mapped through native frame→camera→depth APIs. Multiple,
clipped or stale faces do not produce a target. Frame and resize buffers are released on
success, failure, busy dispatch and unmount; old worker results cannot revive capture.

The model's published face-detection range is not a depth-camera range or an accuracy claim.
The existing absolute/high-quality depth gate, small in-face sample patch and physical
reference requirement remain. On 2026-10-29, a fresh Xcode Run began at thermal state 0. The owner reported face
recognition from approximately 3 m. A bounded scalar log sample contained 155 detector
callbacks, 117 with one face and 109 valid camera-space targets, median worker latency
36.13 ms. These include movement/near-range samples and are not a sustained benchmark or
a measured distance-accuracy result. Some metre readings remained unstable and no ready
event was recorded. A stable approximately 3 m display and its green/tone cue are still
unverified. The debug session later showed Finished running; no post-check thermal reading
was obtained. Keep #259 open for measured reference and remaining lifecycle acceptance.
