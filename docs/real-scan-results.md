# Measured scan integration (#78)

The Scan screen collects delivered frame metadata only during its three-second window.
It reuses `recordFrame`/`finishScan`: eye predictions become `EyeMeasure`s, frames pass
through `analyzeFrame`, then `completeScan` summarizes them and runs `decide`. The first
model failure is sticky and yields `NOT_ASSESSED`; insufficient usable frames yield `RETAKE`.

The selected child and scan identity are frozen at Start. SQLite saves the completed result
before navigation; representative eyes stay only in the Scan context. Failed saves show the
retry flow. Cancel, backgrounding, permission loss and teardown discard capture and suppress
late navigation. A SQLite write already in flight may finish after leaving the screen; it
stores the completed scan, but cannot publish a stale result or affect a later scan.

`demo-unvalidated-v1` uses the shared policy fixture's example thresholds with `validated:
false`. Scan and Result display an explicit unvalidated-demo notice. The local keypoint
weights have no release version yet, so model metadata says `keypoints-local-unversioned`.
No images, landmarks, model files or representative eyes are persisted with the session.

When no child profile exists, History lists sessions saved with `childId: null` and opens
their saved details. These unassigned sessions do not appear in a progress chart, since
they need not represent the same person. Selecting a child continues to show only that
child's sessions. History hides the previous profile's rows while the next query loads.

### Device follow-up (2026-10-27/28)

An Xcode Debug Run on an iPhone 12 Pro Max (iOS 27.0.1, Xcode 27.1) completed an
object-only three-second scan on October 27. The result was `RETAKE`, with `NO_FACE` and
`TOO_FEW_FRAMES`. A read of the app's local SQLite metadata after stopping the app
confirmed 18 delivered frames, 0 usable frames, a 3000 ms duration and null asymmetry.
That run used `demo-unvalidated-v1` and `keypoints-local-unversioned`; it does not prove
eye-model inference. No images or database files are included in this repository.

The camera preview was black during that run. On October 28, the owner reported that
both this app and Apple's Camera preview went black while Device Hub was connected,
and that Apple's rear-camera preview recovered after Device Hub quit, with USB still
connected. This is an observed association, not an established OS-level root cause.
Further live camera checks should keep Device Hub closed.

The saved session had no child profile. History previously hid it behind the add-profile
prompt despite the successful database write. The History fix above addresses that gap.
Regression tests cover opening an unassigned scan, omitting its progress chart, waiting
for profile resolution and hiding the previous profile's rows during a change. On October
28 the updated `Nuedniigerel` workspace built, installed and launched through Xcode Run
on the same physical iPhone, with the existing bundle identifier retained. With no child
profile selected, History listed the October 27 15:06 scan, and its detail showed
`RETAKE`, both reason codes and "Ашигласан кадр: 0 / 18", matching the stored metadata.
This confirms that saved unassigned sessions can be reopened; it does not validate camera
preview or eye inference.

Windows integration tests do not establish screening validity or native acceptance. Keep
#78 open until an Xcode Run on a physical iPhone demonstrates measured results and saved
sessions. The black camera feed in [runtime validation](face-runtime-validation.md), trained
eye weights, approved inputs and calibrated quality/policy limits remain dependencies.
