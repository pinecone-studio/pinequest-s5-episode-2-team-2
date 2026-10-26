import type { EyeMeasure, Point } from "@app/core";

export interface Size {
  width: number;
  height: number;
}

/** How a full-resolution frame is drawn into the preview: scaled to cover, then centred. */
export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface EyeMarks {
  side: EyeMeasure["side"];
  center: Point;
  /** View points. */
  radius: number;
  reflex: Point | null;
}

/** Matches the camera preview's "cover" resize mode, like the landmark overlay. */
export function coverTransform(frame: Size, view: Size): ViewTransform | null {
  if (!(frame.width > 0 && frame.height > 0 && view.width > 0 && view.height > 0)) return null;
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  return {
    scale,
    offsetX: (view.width - frame.width * scale) / 2,
    offsetY: (view.height - frame.height * scale) / 2,
  };
}

export function toView(point: Point, t: ViewTransform): Point {
  return { x: point.x * t.scale + t.offsetX, y: point.y * t.scale + t.offsetY };
}

export function eyeMarks(eye: EyeMeasure, t: ViewTransform): EyeMarks {
  return {
    side: eye.side,
    center: toView(eye.irisCenter, t),
    radius: eye.irisRadius * t.scale,
    reflex: eye.reflex && toView(eye.reflex, t),
  };
}

const fixed = (value: number, digits: number) => value.toFixed(digits);

/** Per-frame values for the debug panel, in frame pixels. Developer-only, not app copy. */
export function debugLines(
  eyes: readonly EyeMeasure[] | null,
  latencyMs: number | null,
  failure: string | null,
): string[] {
  const lines = [
    `latency ${latencyMs === null ? "-" : `${fixed(latencyMs, 0)} ms`}` +
      (failure ? ` · ${failure}` : ""),
  ];
  for (const eye of eyes ?? []) {
    const offset = eye.reflexOffset
      ? `(${fixed(eye.reflexOffset.x, 3)}, ${fixed(eye.reflexOffset.y, 3)})`
      : "none";
    lines.push(
      `${eye.side}: c (${fixed(eye.irisCenter.x, 1)}, ${fixed(eye.irisCenter.y, 1)}) ` +
        `r ${fixed(eye.irisRadius, 1)} · reflex ${offset} · conf ${fixed(eye.confidence, 2)}`,
    );
  }
  return lines;
}
