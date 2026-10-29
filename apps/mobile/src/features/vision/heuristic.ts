import type { Point } from "@app/core";

// The web demo's per-eye measurement (demo/web-poc packages/core/src/measure.ts), the
// TypeScript port of ml/hirschberg/measure.py, as worklets. The app uses it until a keypoint
// model trained on torch captures exists (#274). Thresholds are the demo's placeholders.

/** Grayscale image in 0..255, row by row. */
export interface GrayImage {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

interface Roi {
  x0: number;
  y0: number;
  width: number;
  height: number;
  pixels: Float64Array;
}

function crop(image: GrayImage, center: Point, half: number): Roi {
  "worklet";
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

/** 3x3 Gaussian blur (OpenCV's sigma 0 kernel, reflect-101 borders). */
function blur3(roi: Roi): Float64Array {
  "worklet";
  const { width: w, height: h, pixels } = roi;
  const reflect = (i: number, n: number) => (n === 1 ? 0 : i < 0 ? -i : i >= n ? 2 * n - 2 - i : i);
  const tmp = new Float64Array(w * h);
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const row = y * w;
      tmp[row + x] =
        0.25 * pixels[row + reflect(x - 1, w)]! +
        0.5 * pixels[row + x]! +
        0.25 * pixels[row + reflect(x + 1, w)]!;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[y * w + x] =
        0.25 * tmp[reflect(y - 1, h) * w + x]! +
        0.5 * tmp[y * w + x]! +
        0.25 * tmp[reflect(y + 1, h) * w + x]!;
    }
  }
  return out;
}

function otsuThreshold(values: Float64Array): number {
  "worklet";
  const hist = new Float64Array(256);
  for (let i = 0; i < values.length; i++) {
    hist[Math.min(255, Math.max(0, Math.round(values[i]!)))]! += 1;
  }
  const total = values.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]!;
  let best = 0;
  let bestVar = -1;
  let weightBelow = 0;
  let sumBelow = 0;
  for (let t = 0; t < 256; t++) {
    weightBelow += hist[t]!;
    if (weightBelow === 0 || weightBelow === total) continue;
    sumBelow += t * hist[t]!;
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

/** Labels connected pixels of `mask` with 8 (or 4) neighbours; returns labels and their count. */
function label(
  mask: Uint8Array,
  w: number,
  h: number,
  eight: boolean,
): { labels: Int32Array; count: number } {
  "worklet";
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
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (!eight && dx !== 0 && dy !== 0)) continue;
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
  }
  return { labels, count };
}

interface Circle {
  center: Point;
  radius: number;
}

/** Smallest circle containing all points (Welzl, iterative). */
function enclosingCircle(points: Point[]): Circle {
  "worklet";
  const shuffled = [...points];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (i * 7919) % (i + 1);
    const swap = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = swap;
  }
  const inside = (c: Circle, p: Point) =>
    Math.hypot(p.x - c.center.x, p.y - c.center.y) <= c.radius + 1e-7;
  const two = (a: Point, b: Point): Circle => ({
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    radius: Math.hypot(a.x - b.x, a.y - b.y) / 2,
  });
  const three = (a: Point, b: Point, c: Point): Circle => {
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
  let circle: Circle = { center: shuffled[0] ?? { x: 0, y: 0 }, radius: 0 };
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
export function refineIris(image: GrayImage, center: Point, radius: number): Circle | null {
  "worklet";
  const roi = crop(image, center, Math.ceil(radius * 1.6));
  const { width: w, height: h } = roi;
  if (w === 0 || h === 0) return null;
  const blurred = blur3(roi);
  const threshold = otsuThreshold(blurred);
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) dark[i] = blurred[i]! <= threshold ? 1 : 0;

  const { labels } = label(dark, w, h, true);
  const sx = Math.round(center.x) - roi.x0;
  const sy = Math.round(center.y) - roi.y0;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  let target = labels[sy * w + sx]!;
  if (!target) {
    // The seed is in a bright hole (the reflex): use the dark blob around the hole,
    // unless the bright region reaches the crop border.
    const light = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) light[i] = dark[i] ? 0 : 1;
    const holes = label(light, w, h, false).labels;
    const hole = holes[sy * w + sx]!;
    for (let i = 0; i < w * h; i++) {
      if (holes[i] !== hole) continue;
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return null;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const l = labels[(y + dy) * w + x + dx]!;
        if (l) target = l;
      }
    }
    if (!target) return null;
  }

  const boundary: Point[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] !== target) continue;
      const edge =
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1 ||
        labels[y * w + x + 1] !== target ||
        labels[y * w + x - 1] !== target ||
        labels[(y + 1) * w + x] !== target ||
        labels[(y - 1) * w + x] !== target;
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
  "worklet";
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
        values.push(pixels[y * w + x]!);
      }
    }
  }
  if (values.length === 0) return { reflex: null, blobs: 0 };
  values.sort((a, b) => a - b);
  const mid = values.length / 2;
  const median =
    values.length % 2 ? values[Math.floor(mid)]! : (values[mid - 1]! + values[mid]!) / 2;
  const peak = values[values.length - 1]!;
  if (peak - median < 0.25 * 255) return { reflex: null, blobs: 0 };

  const cut = median + 0.6 * (peak - median);
  const bright = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bright[i] = disc[i] && pixels[i]! >= cut ? 1 : 0;
  const { labels, count } = label(bright, w, h, true);
  if (count === 0) return { reflex: null, blobs: 0 };

  const area = new Float64Array(count + 1);
  for (let i = 0; i < labels.length; i++) if (labels[i]) area[labels[i]!]! += 1;
  let largest = 1;
  for (let l = 2; l <= count; l++) if (area[l]! > area[largest]!) largest = l;

  let sum = 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < w * h; i++) {
    if (labels[i] !== largest) continue;
    const v = pixels[i]!;
    const x = i % w;
    sum += v;
    sumX += v * x;
    sumY += v * ((i - x) / w);
  }
  return { reflex: { x: sumX / sum + roi.x0, y: sumY / sum + roi.y0 }, blobs: count };
}

export interface HeuristicEye extends Circle {
  reflex: Point | null;
  /** The demo's placeholder: 1 for one bright blob, 0.5 for several, halved without a fit. */
  confidence: number;
}

/** Iris and reflex of one eye, starting from a rough iris estimate, in image pixels. */
export function measureEye(image: GrayImage, center: Point, radius: number): HeuristicEye {
  "worklet";
  const refined = refineIris(image, center, radius);
  const iris = refined ?? { center, radius };
  const { reflex, blobs } = findReflex(image, iris.center, iris.radius);
  // TODO(tune): heuristic confidence until a calibrated score exists.
  let confidence = reflex === null ? 0 : blobs === 1 ? 1 : 0.5;
  if (refined === null) confidence *= 0.5;
  return { center: iris.center, radius: iris.radius, reflex, confidence };
}
