import { distanceGuidance } from "./depthDistance";

type Sample = { value: number; at: number };
export type StableDistance = {
  samples: Sample[];
  value: number | null;
  nearSince: number | null;
  ready: boolean;
};
export const emptyDistance = (): StableDistance => ({
  samples: [],
  value: null,
  nearSince: null,
  ready: false,
});
const median = (rows: Sample[]) =>
  rows.map((row) => row.value).sort((a, b) => a - b)[Math.floor(rows.length / 2)]!;

/** Display-only noise limits, not measurement accuracy or clinical tolerances. */
export function stabilizeDistance(
  previous: StableDistance,
  value: number | null,
  at: number,
  now: number,
): StableDistance {
  const last = previous.samples.at(-1);
  if (
    value === null ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isFinite(at) ||
    !Number.isFinite(now) ||
    now < at ||
    now - at > 750 ||
    (last && at <= last.at)
  )
    return emptyDistance();
  let rows =
    last && at - last.at <= 600 ? previous.samples.filter((row) => at - row.at <= 750) : [];
  if (rows.length && Math.abs(value - median(rows)) > 0.15) rows = [];
  rows = [...rows, { value, at }].slice(-5);
  const coherent =
    Math.max(...rows.map((row) => row.value)) - Math.min(...rows.map((row) => row.value)) <= 0.15;
  const stable = coherent && rows.length >= 3 && at - rows[0]!.at >= 400;
  const centre = median(rows);
  // A small dead band prevents the displayed tenth flickering at a rounding boundary.
  const shown = stable
    ? previous.value !== null && Math.abs(centre - previous.value) < 0.075
      ? previous.value
      : Number(centre.toFixed(1))
    : null;
  const near = coherent && distanceGuidance(value) === "ready";
  const nearSince = near ? (rows.length > 1 ? (previous.nearSince ?? at) : at) : null;
  return {
    samples: rows,
    value: shown,
    nearSince,
    ready:
      stable && nearSince !== null && at - nearSince >= 1000 && distanceGuidance(shown) === "ready",
  };
}
