# Live guidance (#13)

The scan preview displays one Mongolian `TODO(copy)` instruction at a time. All shared
`QualityReason` values have copy; face count takes priority, followed by the ordered
capture-quality reasons. Model unavailability is distinct from a successful measurement.
No guidance text implies a diagnosis or healthy eyes.

Live face availability and eye-inference failures come from the frame pipeline. The partial
#5 producer merged in #77 is now attached as `LandmarkFrame.quality` after both camera and
replay inference return to the RN thread. It uses the existing `toEyeMeasures` adapter and
frame-pixel geometry. Heavy inference remains on the worker; the producer's plain functions
are not called inside a worklet. `latencyMs` still measures worker analysis, excluding RN
quality/guidance delivery.

The producer covers face count, landmark eye opening/head pose, measured iris size and reflex
availability. Its existing limits remain `TODO(tune)`; no thresholds are added or changed here.
Pixel blur/exposure checks and Python parity are not implemented by this adapter; sharpness
and exposure stay null. `quality.ok` is not a validated screening acceptance result. The scan
result uses an [explicitly unvalidated demo policy](real-scan-results.md).

Without eye weights, the producer reports `EYE_NOT_FOUND` because measurements are absent.
Guidance preserves the separate `MODEL_UNAVAILABLE`/`MODEL_ERROR` notice instead of telling
the user that a model failure means their eye is missing. Available face-based capture
guidance can still be shown. The producer's failure reasons remain unchanged in the metadata.

Physical-device guidance checks, approved Mongolian copy, calibrated limits, pixel checks
and the remaining #5 acceptance criteria are pending. Synthetic tests do not establish those
results. The camera runtime fix for #11 is a separate prerequisite for live device validation;
this branch is based directly on main and does not duplicate or stack that fix.
