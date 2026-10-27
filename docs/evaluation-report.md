# Evaluation report (#8)

October 2026. No calibration or deviation captures (#29) could be recorded before the pitch,
so this report combines two things that need no recordings:

1. **Calibration from the literature**: how far the reflex moves per degree of gaze.
2. **A bench test on synthetic eyes**: how precisely our measurement code finds that movement,
   how often it fails, and what the app's refer threshold does with the result.

It describes the algorithm, not accuracy on children. The steps to repeat it on real
captures are in [`evaluation-workflow.md`](evaluation-workflow.md).

## 1. Reflex shift per degree

| Quantity                                 | Value                                              | Source                              |
| ---------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| Hirschberg ratio, children 6 mo – 11 y   | 19.9 ± 1.9 PD/mm (95% CI of individuals 16.1–23.6) | Hasebe et al., IOVS 1998;39:2782–5  |
| Hirschberg ratio, adults                 | 21 PD/mm                                           | Brodie, IOVS 1987;28:736–42         |
| Visible iris diameter                    | 11.71 ± 0.42 mm                                    | Rüfer et al., Cornea 2005;24:259–61 |
| Repeatability of a video Hirschberg test | ±0.18 mm (95% limits)                              | Hasebe et al., IOVS 1995;36:2678–85 |

In the app's unit (reflex offset over the iris radius, 5.855 mm), one degree of gaze is
1.75 PD, so **0.088 mm or 0.015 iris radii per degree**. The refer target of 8 PD
(AAPOS 2021, Arnold et al., J AAPOS 2022;26:1.e1–1.e6) is 0.40 mm or **0.069 iris radii**,
the value in `scanPolicy.ts`.

The published repeatability of ±0.18 mm is ±0.031 iris radii, about **±3.6 PD**. That is the
best a real video measurement has done; ours on real eyes should be expected to be no better.

## 2. Synthetic bench test

`python -m hirschberg.bench --trials 40 --scans 40 --seed 0` (`ml/hirschberg/bench.py`).
Eyes are rendered by `hirschberg.synthetic` at -10° to 10°, 40 times per angle and
condition, each from a perturbed rough iris estimate (8% centre, 6% radius error) like the
face landmarks give. The measurement is the same heuristic the CLI uses
(`hirschberg.measure`).

### Measurement

| Condition                        | Slope (95% CI)      | Repeatability SD  | Smallest reliable change |
| -------------------------------- | ------------------- | ----------------- | ------------------------ |
| clean                            | 1.006 (1.002–1.011) | 0.0030 iris radii | 1.0 PD / 0.5°            |
| noisy                            | 1.003 (0.998–1.009) | 0.0038            | 1.2 PD / 0.7°            |
| blurred                          | 1.012 (1.006–1.018) | 0.0041            | 1.3 PD / 0.8°            |
| dark                             | 1.005 (0.999–1.011) | 0.0038            | 1.2 PD / 0.7°            |
| far (iris 22 px)                 | 1.006 (0.996–1.017) | 0.0074            | 2.4 PD / 1.4°            |
| close (iris 60 px)               | 1.006 (1.003–1.010) | 0.0020            | 0.7 PD / 0.4°            |
| hard (far, dark, blurred, noisy) | —                   | —                 | — (no reflex found)      |

The smallest reliable change is 1.96 × √2 × SD / slope: two measurements that differ by
less cannot be told apart. The slope of about 1 means the measured offset follows the true
one without a scale error.

### Failures and keypoint error

| Condition                        | No reflex found     | Iris centre error, median | Reflex error, median |
| -------------------------------- | ------------------- | ------------------------- | -------------------- |
| clean, noisy, blurred, dark      | 0/280 each (0–1.4%) | 0.013–0.014 iris radii    | 0.014                |
| far (iris 22 px)                 | 0/280 (0–1.4%)      | 0.025                     | 0.025                |
| close (iris 60 px)               | 0/280 (0–1.4%)      | 0.009                     | 0.009                |
| hard (far, dark, blurred, noisy) | 280/280 (98.6–100%) | 0.028                     | —                    |

When the reflex is small, blurred and dim at once, the heuristic finds no reflex at all.
That is the safe failure: those frames are rejected (`REFLEX_NOT_FOUND`) and a scan made only
of them ends as RETAKE, not as a wrong outcome. The keypoint model's error on real crops is
in [`model-card.md`](model-card.md) (pilot batch, 12 test crops, no torch reflex yet).

### What the refer threshold does

Simulated 3-second scans: 15 frames, one eye straight and one turned by the given deviation,
scored as the median asymmetry and referred at 0.069 iris radii, 40 scans per row.

| Deviation | Referred, clean | 95% CI    | Referred, far | 95% CI    |
| --------- | --------------- | --------- | ------------- | --------- |
| 0 PD      | 0/40            | 0.00–0.09 | 0/40          | 0.00–0.09 |
| 4 PD      | 0/40            | 0.00–0.09 | 0/40          | 0.00–0.09 |
| 8 PD      | 23/40           | 0.42–0.71 | 21/40         | 0.37–0.67 |
| 12 PD     | 40/40           | 0.91–1.00 | 40/40         | 0.91–1.00 |
| 16–20 PD  | 40/40 each      | 0.91–1.00 | 40/40 each    | 0.91–1.00 |

Exactly at the target (8 PD) about half the scans are referred, as expected for a threshold;
straight eyes are never referred and 12 PD always is.

## 3. What this means

- **The algorithm is not the bottleneck on clean images**: its smallest reliable change
  (0.7–2.4 PD) is well below the 8 PD target, and the slope shows no scale error.
- **Real eyes will be noisier.** The synthetic repeatability is 1.5–5 times better than the
  best published video Hirschberg test (±3.6 PD). With real noise of that size, deviations of
  roughly 4–12 PD will be referred some of the time rather than never or always, and false
  referrals of straight eyes become possible. The real numbers have to come from captures.
- **Distance matters most** of the conditions tested: the far setting doubles the error, so
  the quality limit on iris size (`TOO_FAR`) protects the measurement.
- **Individual Hirschberg ratios vary** (16–24 PD/mm between children), so the same offset can
  mean about ±20% different deviations. This sets a limit no camera can remove.

## 4. Not covered

- Real eyes: lids, lashes, tear film, eye movement during the 3 seconds, the iPhone's torch
  position and optics, dark irises with low contrast to the pupil.
- Children's iris size (the iris data are ages 10–80) and angle kappa differences between eyes.
- The keypoint model on torch-lit crops: it has not been trained on them yet.

Each of these needs the protocol captures. Until then `SCAN_POLICY.validated` stays `false`
and the app labels its results as unvalidated.
