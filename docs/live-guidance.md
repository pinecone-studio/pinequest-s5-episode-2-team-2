# Live guidance (#13)

The scan preview displays one Mongolian `TODO(copy)` instruction at a time. All shared
`QualityReason` values have copy; face count takes priority, followed by the ordered
capture-quality reasons. Model unavailability is distinct from a successful measurement.
No guidance text implies a diagnosis or healthy eyes.

Live face availability and eye-inference failures come from the frame pipeline. The quality
producer for #5 is not present in this checkout: attach its `FrameQuality` as
`LandmarkFrame.quality` when it is ready. No distance, head-pose, eye-opening or lighting
thresholds are invented by the UI. Those instructions are tested against the shared reason
codes and remain pending live producer integration and device checks.
