# Evaluation workflow (#8)

How to go from a capture session to the numbers in the evaluation report and to the scan
thresholds. Every step runs from `ml/` with `uv run`; images and videos stay in the private
Drive, and only the printed reports are copied into `docs/`.

## 1. Check the session

```bash
python -m dataset.sheet_check sheet.csv
```

Fix every **error** (naming, missing consent, `D` scans of children) before going on. The
**missing scans** list shows who still needs `N`, calibration or `D` captures.

## 2. Extract frames

```bash
python -m dataset.frames /drive/session /drive/frames --step 3 --sheet sheet.csv
```

Every third frame of each usable video, named `<capture>_f<frame>.jpg`. Writing inside the
repository is refused.

## 3. Measure every frame

```bash
python -m hirschberg.cli /drive/frames > /drive/results.jsonl
```

One line per frame: both eyes, the asymmetry, and `quality` with the same reason codes the
app uses (`docs/quality-checks.md`).

## 4. Reports

| Question                                      | Command                                          | Uses         |
| --------------------------------------------- | ------------------------------------------------ | ------------ |
| Does each capture give a usable scan?         | `python -m hirschberg.summarize results.jsonl`   | all          |
| Does the reflex move as expected with gaze?   | `python -m hirschberg.calibration results.jsonl` | `C`          |
| Does the score separate deviated from normal? | `python -m hirschberg.evaluate results.jsonl`    | `N` and `D`  |
| Do two annotators agree on the keypoints?     | `python -m dataset.agreement export_*.json`      | Label Studio |

- **summarize**: frames used, median asymmetry and spread per capture, and why frames were
  rejected, most frequent first. Many rejected frames point to a capture problem or to
  quality limits that need tuning.
- **calibration**: reflex shift per degree with a 95% interval, repeatability, the smallest
  reliable change in degrees and prism dioptres, and the asymmetry per gaze angle. Because
  both eyes turn the same way, the mirrored asymmetry grows by about twice the shift per
  degree; a frame where the child looks away would therefore look like a deviation.
- **evaluate**: AUC, sensitivity and specificity at every threshold and the threshold with
  the highest Youden index, with intervals that resample whole people.

All intervals resample people, not frames, so they stay honest with few participants.

## 5. Choose the scan thresholds

`SCAN_POLICY` in `apps/mobile/src/features/scan/scanPolicy.ts` stays `null` (the app shows
labelled mock results) until these are chosen:

1. `referAsymmetry`: start from the `evaluate` threshold with the highest Youden index.
   Prefer a higher value when the sensitivity interval allows it, to keep false referrals
   low. Check it against the smallest reliable change from `calibration`: a threshold below
   that change cannot be told apart from measurement noise.
2. `maxSpread`: look at the spread of `N` captures in `summarize` and pick a value above
   most of them, so steady scans are not sent back for low consistency.
3. `minFramesUsed`: from `summarize`, a value most good captures reach in 3 seconds.

Record the chosen values, the report they came from (session, date, number of people) and
why in the PR that sets them, and give `SCAN_POLICY_VERSION` a new name. Keep
`validated: false`: these are adult intentional deviations, not patients.

## 6. Write the report

Paste the report tables into `docs/model-card.md` under evaluation, with the session list and
the number of people, captures and frames. Say what was not measured (children, real
strabismus, other phones).
