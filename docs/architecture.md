# Architecture

How a 3-second scan turns into a result, which module does each step, and how the same logic
is checked offline. Everything runs on the phone; no image is stored or sent.

## On the phone

```
Camera frame (4K, torch on)
  │  apps/mobile/src/features/vision/useLandmarks.ts, facePipeline.ts
  ▼
Face Landmarker (478 points, both irises)           docs/face-pipeline.md
  │  vision/eyeCrops.ts, eyeFrame.ts, pixels.ts
  ▼
Eye crops, 5 iris radii, 128 px  →  keypoint model   docs/eye-crops.md, docs/model-card.md
  │  measurement/eyeMeasure.ts
  ▼
EyeMeasure per eye: iris centre and radius, reflex, reflex offset in iris radii
  │  vision/frameQuality.ts → packages/core quality.ts, pixels.ts
  ▼
FrameAnalysis: quality reasons + mirrored asymmetry  docs/quality-checks.md
  │  scan/recorder.ts (frames recorded only during the 3 s)
  ▼
summarizeFrames → decide → ScanResult                packages/core aggregate.ts, policy.ts, scan.ts
  │  scan/scanPolicy.ts (thresholds, validated: false)
  ▼
Result screen (+ eye diagram), saved to SQLite       docs/real-scan-results.md
```

- **Live guidance** (`scan/guidance.ts`, `LiveGuidance.tsx`, `steadyGuidance.ts`) turns the
  most important quality reason of recent frames into one steady instruction.
- **Representative eyes** (`packages/core/src/representative.ts`): the usable frame closest to
  the scan's score is drawn on the result screen (`eyeView/`), from the measurement only.
- **Storage** (`apps/mobile/src/storage/`): SQLite with numbered migrations. Children,
  sessions, treatment, habits and vision checks; never images.
- **Other features**: vision check (`acuity/`), history and progress chart (`history/`,
  `progress/`), child profiles (`children/`), treatment timer and weekly bars (`treatment/`),
  habits and reminders (`habits/`), eye tips and eye-rest exercises (`tips/`, `eyeRest/`),
  dashboard (`dashboard/`), settings and data deletion (`settings/`).

## Decision rules

`decide` checks from the safest outcome down, so a poor scan can never reach "no visible sign":

| Order | Condition                                | Outcome                         |
| ----- | ---------------------------------------- | ------------------------------- |
| 1     | The model was missing or failed          | NOT_ASSESSED                    |
| 2     | Fewer usable frames than `minFramesUsed` | RETAKE (with the frame reasons) |
| 3     | Score or spread missing or not finite    | NOT_ASSESSED                    |
| 4     | Spread above `maxSpread`                 | RETAKE (low consistency)        |
| 5     | Score at or above `referAsymmetry`       | REFER                           |
| 6     | Otherwise                                | NO_VISIBLE_SIGN                 |

The score is the median mirrored asymmetry of the usable frames, in iris radii. The refer
threshold corresponds to 8 prism dioptres; its derivation and sources are in
[`references.md`](references.md).

## Offline (Python, `ml/`)

| Step                                                                           | Module                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Check the data sheet                                                           | `dataset/sheet_check.py`                               |
| Frames from capture videos                                                     | `dataset/frames.py`                                    |
| Pre-label crops for Label Studio, build the dataset, check annotator agreement | `dataset/prelabel.py`, `build.py`, `agreement.py`      |
| Train and export the keypoint model                                            | `keypoints/train.py`, `export.py`, `metrics.py`        |
| Measure frames with quality (same rules as the app)                            | `hirschberg/cli.py`, `measure.py`, `quality.py`        |
| Per-capture summary, decision                                                  | `hirschberg/summarize.py`, `aggregate.py`, `policy.py` |
| Calibration and detection reports                                              | `hirschberg/calibration.py`, `evaluate.py`             |
| Synthetic bench test                                                           | `hirschberg/synthetic.py`, `bench.py`                  |

The order to run them is in [`evaluation-workflow.md`](evaluation-workflow.md).

## How the two sides stay the same

- **Shared fixtures** (`packages/core/fixtures/`): inputs with expected outputs that both the
  TypeScript and the Python tests read ([`shared-fixtures.md`](shared-fixtures.md)).
- **Property tests** on both sides over generated inputs: order independence, safe outcomes,
  geometric invariances.
- **Bench test** on synthetic eyes with known ground truth
  ([`evaluation-report.md`](evaluation-report.md)).

## Privacy by design

- Camera frames are processed in memory and dropped; only numbers are saved.
- No network calls for analysis; the app works offline.
- Captures for development stay in the team's private Drive; writing frames inside the
  repository is refused by `dataset/frames.py`, and images, videos and weights are ignored
  by git.
