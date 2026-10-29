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
