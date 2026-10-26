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

Windows integration tests do not establish screening validity or native acceptance. Keep
#78 open until an Xcode Run on a physical iPhone demonstrates measured results and saved
sessions. The black camera feed in [runtime validation](face-runtime-validation.md), trained
eye weights, approved inputs and calibrated quality/policy limits remain dependencies.
