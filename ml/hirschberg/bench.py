"""Bench test of the reflex measurement on synthetic eyes (#8).

Usage: python -m hirschberg.bench [--trials 40] [--scans 40] [--seed 0]

Runs `measure_eye` on eyes rendered by hirschberg.synthetic at known gaze angles and under
harder conditions (noise, blur, dark, far, close), starting from a perturbed rough iris
estimate as the face landmarks would give. Prints a Markdown report with 95% intervals:

- how the measured offset follows the true one (slope), repeatability and the smallest
  reliable change, in iris radii, prism dioptres and degrees;
- the failure rate (no reflex found) and the iris centre and reflex position errors;
- a screening simulation: the share of 3-second scans referred at the app's threshold for
  deviations from 0 to 20 prism dioptres;
- the same projected with the published spread of Hirschberg ratios, iris sizes and video
  measurement noise, which is closer to what real children would give.

The eyes are drawings, so the numbers describe the algorithm under these conditions, not
accuracy on children.
"""

from __future__ import annotations

import argparse
import math
import statistics
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace

import numpy as np

from hirschberg.measure import Point, measure_eye
from hirschberg.synthetic import (
    HIRSCHBERG_RATIO,
    IRIS_RADIUS_MM,
    EyeScene,
    render_eye,
)

Z95 = 1.96
ANGLES = (-10.0, -5.0, -2.5, 0.0, 2.5, 5.0, 10.0)
DEVIATIONS_PD = (0, 4, 8, 12, 16, 20)
# The app's refer threshold (apps/mobile/src/features/scan/scanPolicy.ts): 8 prism dioptres.
REFER_ASYMMETRY = 0.069
FRAMES_PER_SCAN = 15
# Assumed error of the face-landmark iris estimate that seeds the measurement, as a fraction
# of the iris radius; the measurement refines it from the pixels.
ROUGH_CENTER_SD = 0.08
ROUGH_RADIUS_SD = 0.06

CONDITIONS: dict[str, EyeScene] = {
    "clean": EyeScene(noise_sigma=2),
    "noisy": EyeScene(noise_sigma=10),
    "blurred": EyeScene(blur_sigma=1.5, noise_sigma=4),
    "dark": EyeScene(brightness=0.45, noise_sigma=6),
    "far (iris 22 px)": EyeScene(iris_radius=22, noise_sigma=4),
    "close (iris 60 px)": EyeScene(iris_radius=60, noise_sigma=4),
    "hard (far, dark, blurred, noisy)": EyeScene(
        iris_radius=22, brightness=0.5, blur_sigma=1.5, noise_sigma=12
    ),
}


@dataclass(frozen=True)
class Trial:
    true_offset: float
    measured_offset: float | None
    center_error: float | None
    """Iris centre error in iris radii."""
    reflex_error: float | None
    """Reflex position error in iris radii."""


def measure_scene(scene: EyeScene, rng: np.random.Generator) -> Trial:
    jitter = (float(rng.uniform(-0.5, 0.5)), float(rng.uniform(-0.5, 0.5)))
    eye = render_eye(replace(scene, center_jitter=jitter), rng)
    r = eye.iris_radius
    rough = Point(
        eye.iris_center.x + float(rng.normal(0, ROUGH_CENTER_SD * r)),
        eye.iris_center.y + float(rng.normal(0, ROUGH_CENTER_SD * r)),
    )
    rough_radius = r * float(rng.normal(1, ROUGH_RADIUS_SD))
    m = measure_eye(eye.image, "imageLeft", rough, rough_radius)
    center_error = (
        math.dist((m.iris_center.x, m.iris_center.y), (eye.iris_center.x, eye.iris_center.y)) / r
    )
    if m.reflex is None or m.reflex_offset is None:
        return Trial(eye.reflex_offset.x, None, center_error, None)
    reflex_error = math.dist((m.reflex.x, m.reflex.y), (eye.reflex.x, eye.reflex.y)) / r
    return Trial(eye.reflex_offset.x, m.reflex_offset.x, center_error, reflex_error)


def run_condition(scene: EyeScene, trials: int, rng: np.random.Generator) -> list[Trial]:
    return [
        measure_scene(replace(scene, angle_deg=angle), rng)
        for angle in ANGLES
        for _ in range(trials)
    ]


def fit_slope(trials: Sequence[Trial]) -> float | None:
    pts = [(t.true_offset, t.measured_offset) for t in trials if t.measured_offset is not None]
    if len({x for x, _ in pts}) < 2:
        return None
    return float(np.polyfit([x for x, _ in pts], [y for _, y in pts], 1)[0])


def repeatability_sd(trials: Sequence[Trial]) -> float | None:
    """Pooled SD of the measured offset across repeats at the same true offset."""
    groups: dict[float, list[float]] = {}
    for t in trials:
        if t.measured_offset is not None:
            groups.setdefault(round(t.true_offset, 9), []).append(t.measured_offset)
    squares, dof = 0.0, 0
    for values in groups.values():
        if len(values) >= 2:
            mean = sum(values) / len(values)
            squares += sum((v - mean) ** 2 for v in values)
            dof += len(values) - 1
    return math.sqrt(squares / dof) if dof else None


def smallest_change(trials: Sequence[Trial]) -> float | None:
    """1.96 × √2 × SD / slope, in iris radii: the change two measurements can tell apart."""
    sd, slope = repeatability_sd(trials), fit_slope(trials)
    if sd is None or not slope:
        return None
    return Z95 * math.sqrt(2) * sd / abs(slope)


def to_prism_dioptres(offset: float) -> float:
    return offset * IRIS_RADIUS_MM * HIRSCHBERG_RATIO


def to_degrees(offset: float) -> float:
    return math.degrees(math.atan(to_prism_dioptres(offset) / 100))


def failure_rate(trials: Sequence[Trial]) -> float:
    return sum(t.measured_offset is None for t in trials) / len(trials)


def wilson(successes: int, total: int) -> tuple[float, float] | None:
    if total == 0:
        return None
    p = successes / total
    denom = 1 + Z95**2 / total
    centre = (p + Z95**2 / (2 * total)) / denom
    half = Z95 * math.sqrt(p * (1 - p) / total + Z95**2 / (4 * total**2)) / denom
    return max(0.0, centre - half), min(1.0, centre + half)


def bootstrap(
    trials: Sequence[Trial],
    stat: Callable[[Sequence[Trial]], float | None],
    rounds: int = 400,
    seed: int = 0,
) -> tuple[float, float] | None:
    """95% interval of stat over trials resampled with replacement."""
    rng = np.random.default_rng(seed)
    values = []
    for _ in range(rounds):
        sample = [trials[i] for i in rng.integers(len(trials), size=len(trials))]
        value = stat(sample)
        if value is not None and math.isfinite(value):
            values.append(value)
    if not values:
        return None
    lo, hi = np.percentile(values, [2.5, 97.5])
    return float(lo), float(hi)


def median_of(field: str) -> Callable[[Sequence[Trial]], float | None]:
    def stat(trials: Sequence[Trial]) -> float | None:
        values = [getattr(t, field) for t in trials if getattr(t, field) is not None]
        return statistics.median(values) if values else None

    return stat


def scan_score(scene: EyeScene, deviation_pd: float, rng: np.random.Generator) -> float | None:
    """Median asymmetry over the frames of one simulated scan, or None if too few measured.

    One eye looks straight, the other is turned by `deviation_pd`; the asymmetry is the
    difference of their offsets, which is what the mirrored asymmetry measures.
    """
    angle = math.degrees(math.atan(deviation_pd / 100))
    values = []
    for _ in range(FRAMES_PER_SCAN):
        straight = measure_scene(scene, rng)
        turned = measure_scene(replace(scene, angle_deg=angle), rng)
        if straight.measured_offset is not None and turned.measured_offset is not None:
            values.append(abs(turned.measured_offset - straight.measured_offset))
    # The app needs 5 usable frames (SCAN_POLICY.minFramesUsed).
    return statistics.median(values) if len(values) >= 5 else None


# Published variability for the projection below:
# - Hirschberg ratio between children: SD 1.9 PD/mm (Hasebe et al., IOVS 1998;39:2782-5).
# - Visible iris diameter between people: SD 0.42 mm (Rüfer et al., Cornea 2005;24:259-61).
# - Repeated video Hirschberg measurements agree within ±0.18 mm (95% limits, Hasebe et al.,
#   IOVS 1995;36:2678-85), so one measurement has SD 0.18 / (1.96 * sqrt 2) = 0.065 mm.
HIRSCHBERG_RATIO_SD = 1.9
IRIS_DIAMETER_SD_MM = 0.42
MEASUREMENT_SD_MM = 0.18 / (Z95 * math.sqrt(2))


def projected_score(deviation_pd: float, rng: np.random.Generator) -> float:
    """Scan score for one simulated child, with published between-child and measurement spread.

    The deviation becomes a reflex shift through that child's Hirschberg ratio, the shift is
    measured with the published noise, and the app expresses it in that child's own iris
    radii; the threshold assumed the population mean ratio and iris size.
    """
    ratio = max(1.0, float(rng.normal(HIRSCHBERG_RATIO, HIRSCHBERG_RATIO_SD)))
    radius_mm = float(rng.normal(IRIS_RADIUS_MM * 2, IRIS_DIAMETER_SD_MM)) / 2
    shift_mm = deviation_pd / ratio + float(rng.normal(0, MEASUREMENT_SD_MM))
    return abs(shift_mm) / radius_mm


def projected_rows(children: int, rng: np.random.Generator) -> list[str]:
    rows = []
    for d in DEVIATIONS_PD:
        scores = [projected_score(d, rng) for _ in range(children)]
        referred = sum(s >= REFER_ASYMMETRY for s in scores)
        rows.append(
            f"| {d} PD | {statistics.median(scores):.3f} | {referred}/{children} | "
            f"{_ci(wilson(referred, children), 2)} |"
        )
    return rows


def _fmt(v: float | None, digits: int = 3) -> str:
    return "n/a" if v is None else f"{v:.{digits}f}"


def _ci(ci: tuple[float, float] | None, digits: int = 3) -> str:
    return "n/a" if ci is None else f"{ci[0]:.{digits}f} to {ci[1]:.{digits}f}"


def condition_rows(name: str, trials: Sequence[Trial]) -> tuple[str, str]:
    failed = sum(t.measured_offset is None for t in trials)
    change = smallest_change(trials)
    measurement = (
        f"| {name} | {_fmt(fit_slope(trials))} ({_ci(bootstrap(trials, fit_slope))}) | "
        f"{_fmt(repeatability_sd(trials), 4)} ({_ci(bootstrap(trials, repeatability_sd), 4)}) | "
        f"{_fmt(change)} | {_fmt(change and to_prism_dioptres(change), 1)} PD / "
        f"{_fmt(change and to_degrees(change), 1)} deg |"
    )
    errors = (
        f"| {name} | {failed}/{len(trials)} ({_ci(wilson(failed, len(trials)))}) | "
        f"{_fmt(median_of('center_error')(trials))} "
        f"({_ci(bootstrap(trials, median_of('center_error')))}) | "
        f"{_fmt(median_of('reflex_error')(trials))} "
        f"({_ci(bootstrap(trials, median_of('reflex_error')))}) |"
    )
    return measurement, errors


def screening_rows(scene: EyeScene, scans: int, rng: np.random.Generator) -> list[str]:
    rows = []
    for d in DEVIATIONS_PD:
        scores = [scan_score(scene, d, rng) for _ in range(scans)]
        done = [s for s in scores if s is not None]
        referred = sum(s >= REFER_ASYMMETRY for s in done)
        median = statistics.median(done) if done else None
        rows.append(
            f"| {d} PD | {_fmt(median)} | {referred}/{len(done)} | "
            f"{_ci(wilson(referred, len(done)), 2)} | {scans - len(done)} |"
        )
    return rows


def report(trials: int, scans: int, seed: int, children: int = 2000) -> str:
    rng = np.random.default_rng(seed)
    results = {name: run_condition(scene, trials, rng) for name, scene in CONDITIONS.items()}
    lines = [
        "# Synthetic bench test",
        "",
        f"{trials} renders per angle ({', '.join(f'{a:g} deg' for a in ANGLES)}) per condition, "
        f"seed {seed}. Offsets are in iris radii.",
        "",
        "| Condition | Slope (95% CI) | Repeatability SD (95% CI) | Smallest reliable change "
        "| Same in PD / degrees |",
        "| --- | --- | --- | --- | --- |",
    ]
    error_lines = [
        "",
        "| Condition | No reflex found (95% CI) | Iris centre error, median (95% CI) "
        "| Reflex error, median (95% CI) |",
        "| --- | --- | --- | --- |",
    ]
    for name, condition_trials in results.items():
        measurement, errors = condition_rows(name, condition_trials)
        lines.append(measurement)
        error_lines.append(errors)
    lines += error_lines
    for name in ("clean", "far (iris 22 px)"):
        lines += [
            "",
            f"Screening simulation ({name}): {scans} scans of {FRAMES_PER_SCAN} frames per "
            f"deviation, referred at {REFER_ASYMMETRY} iris radii (8 PD).",
            "",
            "| Deviation | Median score | Referred | 95% CI | Scans without 5 usable frames |",
            "| --- | --- | --- | --- | --- |",
            *screening_rows(CONDITIONS[name], scans, rng),
        ]
    lines += [
        "",
        f"Projection with published variability: {children} simulated children per deviation, "
        f"Hirschberg ratio SD {HIRSCHBERG_RATIO_SD} PD/mm, iris diameter SD "
        f"{IRIS_DIAMETER_SD_MM} mm, measurement SD {MEASUREMENT_SD_MM:.3f} mm.",
        "",
        "| Deviation | Median score | Referred | 95% CI |",
        "| --- | --- | --- | --- |",
        *projected_rows(children, rng),
    ]
    lines += [
        "",
        "Synthetic drawings test the algorithm, not children's eyes: real lids, lashes, tear",
        "film, movement and phone optics are not modelled.",
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--trials", type=int, default=40)
    parser.add_argument("--scans", type=int, default=40)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--children", type=int, default=2000)
    args = parser.parse_args(argv)
    if args.trials < 2 or args.scans < 1:
        parser.error("--trials must be at least 2 and --scans at least 1")
    print(report(args.trials, args.scans, args.seed, args.children))
    return 0


if __name__ == "__main__":
    sys.exit(main())
