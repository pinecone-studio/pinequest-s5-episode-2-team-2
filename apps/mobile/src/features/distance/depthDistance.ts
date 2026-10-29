import type { Depth, ScannedObject } from "react-native-vision-camera";

/** UI guidance follows the displayed tenth of a metre; it does not validate a clinical setup. */
export function distanceGuidance(
  metres: number | null,
): "unknown" | "farther" | "closer" | "ready" {
  if (metres === null || !Number.isFinite(metres) || metres <= 0) return "unknown";
  const shown = Number(metres.toFixed(1));
  return shown === 3 ? "ready" : shown < 3 ? "farther" : "closer";
}

export interface FaceTarget {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
  at: number;
}

/** Native metadata coordinates, not preview coordinates; reject ambiguity instead of a wall. */
export function singleFace(
  objects: Pick<ScannedObject, "type" | "boundingBox">[],
  now: number,
): FaceTarget | null {
  "worklet";
  const faces = objects.filter((object) => object.type === "face");
  if (faces.length !== 1 || !Number.isFinite(now)) return null;
  const b = faces[0]!.boundingBox;
  if (
    ![b.x, b.y, b.width, b.height].every(Number.isFinite) ||
    b.width <= 0 ||
    b.height <= 0 ||
    b.x < 0 ||
    b.y < 0 ||
    b.x + b.width > 1 ||
    b.y + b.height > 1
  )
    return null;
  return {
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
    halfWidth: b.width / 2,
    halfHeight: b.height / 2,
    at: now,
  };
}

/** Median of a small native float32 depth patch, in metres, respecting padded row strides. */
export function sampleMetres(
  buffer: ArrayBuffer,
  width: number,
  height: number,
  stride: number,
  x: number,
  y: number,
  radiusX = 1,
  radiusY = 1,
): number | null {
  "worklet";
  if (
    ![width, height, stride, radiusX, radiusY].every(Number.isInteger) ||
    radiusX < 1 ||
    radiusY < 1 ||
    radiusX > 12 ||
    radiusY > 12 ||
    width <= 0 ||
    height <= 0 ||
    stride < width * 4 ||
    buffer.byteLength < stride * height ||
    ![x, y].every(Number.isFinite)
  )
    return null;
  const cx = Math.round(x),
    cy = Math.round(y);
  if (cx < radiusX || cy < radiusY || cx >= width - radiusX || cy >= height - radiusY) return null;
  const values: number[] = [],
    view = new DataView(buffer);
  const broad = radiusX > 1 || radiusY > 1;
  let total = 0;
  for (let dy = -radiusY; dy <= radiusY; dy++)
    for (let dx = -radiusX; dx <= radiusX; dx++) {
      if (broad && (dx / radiusX) ** 2 + (dy / radiusY) ** 2 > 1) continue;
      total++;
      const value = view.getFloat32((cy + dy) * stride + (cx + dx) * 4, true);
      if (Number.isFinite(value) && value > 0) values.push(value);
    }
  if (values.length < Math.max(5, broad ? Math.ceil(total * 0.6) : 5)) return null;
  values.sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)]!;
  // Mixed foreground/background or highly scattered sensor values are not a stable face surface.
  const spread =
    values[Math.floor(values.length * 0.75)]! - values[Math.floor(values.length * 0.25)]!;
  return broad && spread > Math.max(0.15, median * 0.15) ? null : median;
}

/** Never interpret relative disparity, stale targets or low-quality data as physical metres. */
export function personMetres(depth: Depth, target: FaceTarget | null, now: number): number | null {
  "worklet";
  if (
    !target ||
    !Number.isFinite(now) ||
    now < target.at ||
    now - target.at > 750 ||
    !depth.isValid ||
    depth.depthDataAccuracy !== "absolute" ||
    depth.depthDataQuality !== "high"
  )
    return null;
  let converted: Depth | undefined;
  try {
    if (depth.pixelFormat !== "depth-32-bit") {
      if (!depth.availableDepthPixelFormats.includes("depth-32-bit")) return null;
      converted = depth.convert("depth-32-bit");
    }
    const source = converted ?? depth;
    const point = source.convertCameraPointToDepthPoint({ x: target.x, y: target.y });
    const a = source.convertCameraPointToDepthPoint({
      x: target.x - target.halfWidth,
      y: target.y - target.halfHeight,
    });
    const b = source.convertCameraPointToDepthPoint({
      x: target.x + target.halfWidth,
      y: target.y + target.halfHeight,
    });
    // The full 3x3 patch must fit inside the detected face, rather than sample a background wall.
    const cx = Math.round(point.x),
      cy = Math.round(point.y);
    if (
      ![a.x, a.y, b.x, b.y].every(Number.isFinite) ||
      cx - 1 < Math.min(a.x, b.x) ||
      cx + 1 > Math.max(a.x, b.x) ||
      cy - 1 < Math.min(a.y, b.y) ||
      cy + 1 > Math.max(a.y, b.y)
    )
      return null;
    const metres = sampleMetres(
      source.getDepthData(),
      source.width,
      source.height,
      source.bytesPerRow,
      point.x,
      point.y,
      Math.max(
        1,
        Math.min(12, Math.floor(Math.min(cx - Math.min(a.x, b.x), Math.max(a.x, b.x) - cx) * 0.5)),
      ),
      Math.max(
        1,
        Math.min(12, Math.floor(Math.min(cy - Math.min(a.y, b.y), Math.max(a.y, b.y) - cy) * 0.5)),
      ),
    );
    // A positive sub-display-resolution sample must not be rounded into a valid-looking 0.0 m.
    return metres !== null && Math.round(metres * 10) > 0 ? metres : null;
  } finally {
    converted?.dispose();
  }
}
