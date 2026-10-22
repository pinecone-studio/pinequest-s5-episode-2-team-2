import { reflexOffset } from "./geometry";
import type { EyeMeasure, EyeSide, GrayImage, Point } from "./types";

// Per-eye measurement on a grayscale image. Same steps as ml/hirschberg/measure.py,
// without OpenCV so it runs in a browser or a frame processor.

interface Roi {
  x0: number;
  y0: number;
  width: number;
  height: number;
  pixels: Float64Array;
}

function crop(image: GrayImage, center: Point, half: number): Roi {
  const x0 = Math.max(Math.round(center.x) - half, 0);
  const y0 = Math.max(Math.round(center.y) - half, 0);
  const x1 = Math.min(Math.round(center.x) + half + 1, image.width);
  const y1 = Math.min(Math.round(center.y) + half + 1, image.height);
  const width = Math.max(x1 - x0, 0);
  const height = Math.max(y1 - y0, 0);
  const pixels = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = image.data[(y0 + y) * image.width + x0 + x] ?? 0;
    }
  }
  return { x0, y0, width, height, pixels };
}

function at(a: ArrayLike<number>, i: number): number {
  return a[i] ?? 0;
}

/** 3x3 Gaussian blur (OpenCV's sigma 0 kernel, reflect-101 borders). */
function blur3(roi: Roi): Float64Array {
  const { width: w, height: h, pixels } = roi;
  const reflect = (i: number, n: number) => (n === 1 ? 0 : i < 0 ? -i : i >= n ? 2 * n - 2 - i : i);
  const tmp = new Float64Array(w * h);
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const row = y * w;
      tmp[row + x] =
        0.25 * at(pixels, row + reflect(x - 1, w)) +
        0.5 * at(pixels, row + x) +
        0.25 * at(pixels, row + reflect(x + 1, w));
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[y * w + x] =
        0.25 * at(tmp, reflect(y - 1, h) * w + x) +
        0.5 * at(tmp, y * w + x) +
        0.25 * at(tmp, reflect(y + 1, h) * w + x);
    }
  }
  return out;
}

function otsuThreshold(values: Float64Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of values) hist[Math.min(255, Math.max(0, Math.round(v)))]! += 1;
  const total = values.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * at(hist, t);
  let best = 0;
  let bestVar = -1;
  let weightBelow = 0;
  let sumBelow = 0;
  for (let t = 0; t < 256; t++) {
    weightBelow += at(hist, t);
    if (weightBelow === 0 || weightBelow === total) continue;
    sumBelow += t * at(hist, t);
    const meanBelow = sumBelow / weightBelow;
    const meanAbove = (sumAll - sumBelow) / (total - weightBelow);
    const between = weightBelow * (total - weightBelow) * (meanBelow - meanAbove) ** 2;
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

const N8 = [-1, 0, 1]
  .flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const))
  .filter(([dx, dy]) => dx !== 0 || dy !== 0);
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Labels connected pixels of `mask`; returns the label image and the number of labels. */
function label(
  mask: Uint8Array,
  w: number,
  h: number,
  neighbours: readonly (readonly [number, number])[],
): { labels: Int32Array; count: number } {
  const labels = new Int32Array(w * h);
  let count = 0;
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start]) continue;
    count += 1;
    labels[start] = count;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of neighbours) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (mask[j] && !labels[j]) {
          labels[j] = count;
          stack.push(j);
        }
      }
    }
  }
  return { labels, count };
}

/** Smallest circle containing all points (Welzl, iterative). */
function enclosingCircle(points: Point[]): { center: Point; radius: number } {
  const shuffled = [...points];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (i * 7919) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const inside = (c: { center: Point; radius: number }, p: Point) =>
    Math.hypot(p.x - c.center.x, p.y - c.center.y) <= c.radius + 1e-7;
  const two = (a: Point, b: Point) => ({
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    radius: Math.hypot(a.x - b.x, a.y - b.y) / 2,
  });
  const three = (a: Point, b: Point, c: Point) => {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-12) {
      const pairs = [two(a, b), two(a, c), two(b, c)];
      return pairs.reduce((m, p) => (p.radius > m.radius ? p : m));
    }
    const a2 = a.x ** 2 + a.y ** 2;
    const b2 = b.x ** 2 + b.y ** 2;
    const c2 = c.x ** 2 + c.y ** 2;
    const center = {
      x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
    };
    return { center, radius: Math.hypot(a.x - center.x, a.y - center.y) };
  };
  let circle = { center: shuffled[0] ?? { x: 0, y: 0 }, radius: 0 };
  for (let i = 1; i < shuffled.length; i++) {
    const p = shuffled[i]!;
    if (inside(circle, p)) continue;
    circle = { center: p, radius: 0 };
    for (let j = 0; j < i; j++) {
      const q = shuffled[j]!;
      if (inside(circle, q)) continue;
      circle = two(p, q);
      for (let k = 0; k < j; k++) {
        const r = shuffled[k]!;
        if (!inside(circle, r)) circle = three(p, q, r);
      }
    }
  }
  return circle;
}

/**
 * Refines a rough iris estimate by fitting a circle to the dark iris blob.
 * Bright spots inside the iris (the reflex) do not affect the fit.
 */
export function refineIris(
  image: GrayImage,
  center: Point,
  radius: number,
): { center: Point; radius: number } | null {
  const roi = crop(image, center, Math.ceil(radius * 1.6));
  const { width: w, height: h } = roi;
  if (w === 0 || h === 0) return null;
  const blurred = blur3(roi);
  const threshold = otsuThreshold(blurred);
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) dark[i] = at(blurred, i) <= threshold ? 1 : 0;

  const { labels } = label(dark, w, h, N8);
  const sx = Math.round(center.x) - roi.x0;
  const sy = Math.round(center.y) - roi.y0;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  let target = at(labels, sy * w + sx);
  if (!target) {
    // The seed is in a bright hole (the reflex): use the dark blob around the hole,
    // unless the bright region reaches the crop border.
    const light = dark.map((d) => (d ? 0 : 1));
    const holes = label(light, w, h, N4).labels;
    const hole = at(holes, sy * w + sx);
    for (let i = 0; i < w * h && target >= 0; i++) {
      if (at(holes, i) !== hole) continue;
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return null;
      for (const [dx, dy] of N4) {
        const l = at(labels, (y + dy) * w + x + dx);
        if (l) target = l;
      }
    }
    if (!target) return null;
  }

  const boundary: Point[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(labels, y * w + x) !== target) continue;
      const edge = N4.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx < 0 || ny < 0 || nx >= w || ny >= h || at(labels, ny * w + nx) !== target;
      });
      if (edge) boundary.push({ x, y });
    }
  }
  const fit = enclosingCircle(boundary);
  if (fit.radius < radius * 0.5 || fit.radius > radius * 1.5) return null;
  return { center: { x: fit.center.x + roi.x0, y: fit.center.y + roi.y0 }, radius: fit.radius };
}

/**
 * Finds the brightest blob inside the iris disc. Returns the intensity-weighted centroid
 * of the largest bright blob and the number of bright blobs found.
 */
export function findReflex(
  image: GrayImage,
  irisCenter: Point,
  irisRadius: number,
): { reflex: Point | null; blobs: number } {
  const roi = crop(image, irisCenter, Math.ceil(irisRadius));
  const { width: w, height: h, pixels } = roi;
  if (w === 0 || h === 0) return { reflex: null, blobs: 0 };

  // TODO(tune): margin, contrast and threshold ratios are placeholders until calibration data.
  // The margin keeps bright sclera at the iris edge out of the search disc.
  const searchRadius = Math.round(irisRadius - Math.max(2, 0.1 * irisRadius));
  const cx = Math.round(irisCenter.x) - roi.x0;
  const cy = Math.round(irisCenter.y) - roi.y0;
  const disc = new Uint8Array(w * h);
  const values: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= searchRadius ** 2) {
        disc[y * w + x] = 1;
        values.push(at(pixels, y * w + x));
      }
    }
  }
  if (values.length === 0) return { reflex: null, blobs: 0 };
  values.sort((a, b) => a - b);
  const mid = values.length / 2;
  const median =
    values.length % 2 ? at(values, Math.floor(mid)) : (at(values, mid - 1) + at(values, mid)) / 2;
  const peak = at(values, values.length - 1);
  if (peak - median < 0.25 * 255) return { reflex: null, blobs: 0 };

  const cut = median + 0.6 * (peak - median);
  const bright = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bright[i] = disc[i] && at(pixels, i) >= cut ? 1 : 0;
  const { labels, count } = label(bright, w, h, N8);
  if (count === 0) return { reflex: null, blobs: 0 };

  const area = new Array<number>(count + 1).fill(0);
  for (const l of labels) if (l) area[l]! += 1;
  let largest = 1;
  for (let l = 2; l <= count; l++) if (at(area, l) > at(area, largest)) largest = l;

  let sum = 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < w * h; i++) {
    if (labels[i] !== largest) continue;
    const v = at(pixels, i);
    const x = i % w;
    sum += v;
    sumX += v * x;
    sumY += v * ((i - x) / w);
  }
  return { reflex: { x: sumX / sum + roi.x0, y: sumY / sum + roi.y0 }, blobs: count };
}

export function measureEye(
  image: GrayImage,
  side: EyeSide,
  center: Point,
  radius: number,
): EyeMeasure {
  const refined = refineIris(image, center, radius);
  const irisCenter = refined?.center ?? center;
  const irisRadius = refined?.radius ?? radius;
  const { reflex, blobs } = findReflex(image, irisCenter, irisRadius);
  // TODO(tune): heuristic confidence until a calibrated score exists.
  let confidence = reflex === null ? 0 : blobs === 1 ? 1 : 0.5;
  if (refined === null) confidence *= 0.5;
  return {
    side,
    irisCenter,
    irisRadius,
    reflex,
    reflexOffset: reflex && reflexOffset(irisCenter, irisRadius, reflex),
    confidence,
  };
}
