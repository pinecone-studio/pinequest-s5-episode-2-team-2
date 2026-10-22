import "./style.css";
import { decide, summarizeFrames } from "@app/core";
import type { EyeMeasure, Outcome, PolicyConfig } from "@app/core";
import { acuityFlow } from "./acuity";
import { analyzeFrame, loadLandmarker, startCamera, stopCamera } from "./scanner";
import type { EyeCrop, FrameResult } from "./scanner";
import { t } from "./strings";

const SCAN_MS = 3000;
// TODO(tune): demo-only thresholds, not validated. Set from team test scans; shown as such.
const DEMO_POLICY: PolicyConfig = {
  referAsymmetry: 0.15,
  minFramesUsed: 10,
  maxSpread: 0.1,
  validated: false,
};
const app = document.querySelector<HTMLDivElement>("#app")!;
/** This session's scans, in memory only. */
const history: { outcome: Outcome; score: number | null }[] = [];

const icon = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  check:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  bolt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 2h6l-1 7h4l-8 13 1-9H7z"/></svg>',
  info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
};

let cleanup: (() => void) | null = null;

function show(screen: () => void) {
  cleanup?.();
  cleanup = null;
  screen();
  window.scrollTo(0, 0);
}

function on(selector: string, handler: () => void) {
  app.querySelector(selector)?.addEventListener("click", handler);
}

function startScreen() {
  app.innerHTML = `
    <main class="screen start">
      <div class="start-head">
        <span class="badge">${t.badge}</span>
        <h1>${t.appName}</h1>
        <p>${t.tagline}</p>
      </div>
      <img class="hero" src="/img/kid-telescope.png" alt="" />
      <div class="actions">
        <button class="btn primary" id="go">${t.start} ${icon.next}</button>
        <button class="btn secondary" id="acuity">${t.acuity.startButton}</button>
        <button class="btn link" id="parents">${t.forParents}</button>
        <p class="footnote">${t.footerPrivacy} · ${t.footerNoDiagnosis}</p>
        <p class="offline" id="offline" ${offlineReady ? "" : "hidden"}>${icon.check} ${t.offlineReady}</p>
      </div>
    </main>`;
  on("#go", () => show(scanScreen));
  on("#parents", () => show(parentsScreen));
  on("#acuity", () =>
    show(
      acuityFlow({
        app,
        show,
        setCleanup: (fn) => (cleanup = fn),
        home: startScreen,
        icon,
      }),
    ),
  );
  // Load the face model early so the scan also works after going offline.
  loadLandmarker().catch(() => undefined);
}

function drawOverlay(canvas: HTMLCanvasElement, w: number, h: number, frame: FrameResult | null) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  for (const eye of frame?.analysis.eyes ?? []) drawEye(ctx, eye, Math.max(2, w / 600));
}

function drawEye(ctx: CanvasRenderingContext2D, eye: EyeMeasure, line: number) {
  ctx.lineWidth = line;
  ctx.strokeStyle = "#14B8A6";
  ctx.beginPath();
  ctx.arc(eye.irisCenter.x, eye.irisCenter.y, eye.irisRadius, 0, Math.PI * 2);
  ctx.stroke();
  if (eye.reflex) {
    ctx.strokeStyle = "#F59E0B";
    ctx.beginPath();
    ctx.arc(eye.reflex.x, eye.reflex.y, Math.max(eye.irisRadius * 0.28, line * 3), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function scanScreen() {
  app.innerHTML = `
    <main class="screen scan">
      <div class="camera">
        <video id="video" playsinline muted autoplay></video>
        <canvas id="overlay"></canvas>
        <div class="guide" aria-hidden="true"></div>
      </div>
      <div class="scan-top">
        <button class="round" id="back" aria-label="${t.back}">${icon.back}</button>
        <span class="pill" id="torch" hidden>${icon.bolt} <span></span></span>
      </div>
      <p class="instructions">${t.instructions}</p>
      <section class="sheet">
        <div class="chips">
          <span class="chip" id="chip-face">${icon.check} ${t.faceFound}</span>
          <span class="chip" id="chip-eyes">${icon.check} ${t.eyesFound}</span>
          <span class="chip" id="chip-reflex">${icon.check} ${t.reflexFound}</span>
        </div>
        <div class="ring">
          <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="52" class="ring-bg"/>
            <circle cx="60" cy="60" r="52" class="ring-fg" id="ring" stroke-dasharray="326.7" stroke-dashoffset="326.7" transform="rotate(-90 60 60)"/>
          </svg>
          <div class="ring-label"><strong id="secs">0.0 s</strong><span>${t.of3s}</span></div>
        </div>
        <p class="status" id="status">${t.loading}</p>
        <button class="btn primary" id="scan" disabled>${t.scan}</button>
      </section>
    </main>`;

  const video = app.querySelector<HTMLVideoElement>("#video")!;
  const overlay = app.querySelector<HTMLCanvasElement>("#overlay")!;
  const frame = document.createElement("canvas");
  const scanButton = app.querySelector<HTMLButtonElement>("#scan")!;
  const status = app.querySelector<HTMLParagraphElement>("#status")!;
  let running = true;
  let scanStart: number | null = null;
  const collected: FrameResult[] = [];

  cleanup = () => {
    running = false;
    stopCamera(video);
  };
  on("#back", () => show(startScreen));

  const setChip = (id: string, ok: boolean) =>
    app.querySelector(`#${id}`)?.classList.toggle("ok", ok);

  Promise.all([startCamera(video), loadLandmarker()])
    .then(([{ torch }, faces]) => {
      const pill = app.querySelector<HTMLSpanElement>("#torch")!;
      pill.hidden = false;
      pill.classList.toggle("warn", !torch);
      pill.querySelector("span")!.textContent = torch ? t.torchOn : t.torchOff;
      status.textContent = "";
      scanButton.disabled = false;
      scanButton.addEventListener("click", () => {
        scanStart = performance.now();
        collected.length = 0;
        scanButton.hidden = true;
        status.textContent = t.keepStill;
      });

      const tick = () => {
        if (!running) return;
        if (video.readyState >= 2) {
          const now = performance.now();
          const result = analyzeFrame(video, frame, faces, now);
          const reasons = result.analysis.quality.reasons;
          setChip("chip-face", !reasons.includes("NO_FACE") && !reasons.includes("MULTIPLE_FACES"));
          setChip("chip-eyes", result.analysis.eyes !== null);
          setChip("chip-reflex", result.analysis.quality.ok);
          drawOverlay(overlay, video.videoWidth, video.videoHeight, result);

          if (scanStart !== null) {
            collected.push(result);
            const elapsed = Math.min(now - scanStart, SCAN_MS);
            app
              .querySelector("#ring")!
              .setAttribute("stroke-dashoffset", String(326.7 * (1 - elapsed / SCAN_MS)));
            app.querySelector("#secs")!.textContent = `${(elapsed / 1000).toFixed(1)} s`;
            if (elapsed >= SCAN_MS) {
              const frames = [...collected];
              show(() => resultScreen(frames));
              return;
            }
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })
    .catch(() => {
      status.textContent = t.cameraError;
    });
}

function bestFrame(frames: FrameResult[]): FrameResult | null {
  let best: FrameResult | null = null;
  let bestScore = -1;
  for (const f of frames) {
    if (!f.analysis.quality.ok || !f.analysis.eyes || !f.crops) continue;
    const score = Math.min(...f.analysis.eyes.map((e) => e.confidence));
    if (score >= bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

function fmt(n: number): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;
}

function cropCanvas(crop: EyeCrop): HTMLCanvasElement {
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const scale = size / Math.max(crop.canvas.width, crop.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.drawImage(crop.canvas, 0, 0);
  drawEye(ctx, crop.eye, 2 / scale);
  return canvas;
}

function resultScreen(frames: FrameResult[]) {
  const scan = summarizeFrames(frames.map((f) => f.analysis));
  const { summary } = scan;
  const decision = decide({ ...scan, failure: null }, DEMO_POLICY);
  const copy = t.outcomes[decision.outcome];
  history.push({ outcome: decision.outcome, score: summary.asymmetryScore });
  const best = bestFrame(frames);
  const eyes = best?.analysis.eyes;
  const tips = [...new Set(decision.reasons.map((r) => t.tips[r]).filter(Boolean))];
  const next = decision.outcome === "RETAKE" && tips.length ? tips : copy.next;

  app.innerHTML = `
    <main class="screen page">
      <header class="page-head">
        <button class="round plain" id="back" aria-label="${t.back}">${icon.back}</button>
        <h1>${t.resultTitle}</h1>
      </header>
      <section class="card verdict ${decision.outcome.toLowerCase()}">
        <span class="verdict-dot" aria-hidden="true"></span>
        <div>
          <h2>${copy.title}</h2>
          <p>${copy.body}</p>
        </div>
      </section>
      ${
        best && eyes
          ? `<section class="card">
              <div class="eyes" id="eyes"></div>
              <div class="legend">
                <span><i class="dot teal"></i>${t.iris}</span>
                <span><i class="dot amber"></i>${t.reflex}</span>
              </div>
            </section>`
          : ""
      }
      <section class="card plain-text">
        <h3>${t.whatNext}</h3>
        <ul>${next.map((line) => `<li>${line}</li>`).join("")}</ul>
      </section>
      <section class="card plain-text">
        <h3>${t.whatItMeans}</h3>
        <p>${t.explanation}</p>
      </section>
      ${
        history.length > 1
          ? `<section class="card plain-text">
              <h3>${t.sessionTitle}</h3>
              <ol class="history">${history
                .map(
                  (h, i) =>
                    `<li><span class="verdict-dot small ${h.outcome.toLowerCase()}"></span>${t.scanNumber(i + 1)} · ${t.outcomes[h.outcome].short}${h.score === null ? "" : ` · ${h.score.toFixed(2)}`}</li>`,
                )
                .join("")}</ol>
            </section>`
          : ""
      }
      <details class="card details">
        <summary>${t.details}</summary>
        ${
          eyes
            ? `<div class="eye-values">
                <div><span>${t.imageLeft}</span><strong>x ${fmt(eyes[0].reflexOffset!.x)} · y ${fmt(eyes[0].reflexOffset!.y)}</strong></div>
                <div><span>${t.imageRight}</span><strong>x ${fmt(eyes[1].reflexOffset!.x)} · y ${fmt(eyes[1].reflexOffset!.y)}</strong></div>
              </div>`
            : ""
        }
        <div class="stats">
          <div><span>${t.difference}</span><strong>${summary.asymmetryScore?.toFixed(2) ?? "—"}</strong></div>
          <div><span>${t.framesUsed}</span><strong>${summary.framesUsed} / ${summary.framesTotal}</strong></div>
          <div><span>${t.spread}</span><strong>${summary.spread?.toFixed(2) ?? "—"}</strong></div>
          <div><span>${t.demoThreshold}</span><strong>${DEMO_POLICY.referAsymmetry.toFixed(2)}</strong></div>
        </div>
        <p class="hint">${t.offsetHint}. ${t.differenceHint}. ${t.thresholdNote}</p>
      </details>
      <p class="notice">${icon.info}<span>${t.whitePupil}</span></p>
      <p class="notice">${icon.info}<span>${t.notice}</span></p>
      <div class="spacer"></div>
      <div class="actions">
        <button class="btn primary" id="again">${t.scanAgain}</button>
        <button class="btn outline" id="parents">${t.parentsTitle}</button>
      </div>
    </main>`;

  if (best?.crops) {
    const holder = app.querySelector("#eyes")!;
    best.crops.forEach((crop) => holder.appendChild(cropCanvas(crop)));
  }
  on("#back", () => show(startScreen));
  on("#again", () => show(scanScreen));
  on("#parents", () => show(parentsScreen));
}

function parentsScreen() {
  const facts = [
    ["~3%", "amber", t.fact1, t.fact1Source],
    ["", "green", t.fact2, t.fact2Source],
    ["", "blue", t.fact3, t.fact3Source],
  ];
  app.innerHTML = `
    <main class="screen page">
      <header class="page-head">
        <button class="round plain" id="back" aria-label="${t.back}">${icon.back}</button>
        <h1>${t.parentsTitle}</h1>
      </header>
      <section class="card parents-hero">
        <h2>${t.parentsHero}</h2>
        <img src="/img/parent-kid.png" alt="" />
      </section>
      ${facts
        .map(
          ([badge, tone, text, source]) => `
        <section class="card fact">
          <span class="fact-badge ${tone}">${badge || icon.check}</span>
          <div><p>${text}</p><small>${source}</small></div>
        </section>`,
        )
        .join("")}
      <p class="notice plain">${t.parentsNotice}</p>
      <div class="spacer"></div>
      <div class="actions"><button class="btn primary" id="go">${t.start}</button></div>
    </main>`;
  on("#back", () => show(startScreen));
  on("#go", () => show(scanScreen));
}

let offlineReady = false;

/** Caches the page, model and assets so the demo also runs in airplane mode. */
async function setupOffline() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "cached") return;
    offlineReady = true;
    const badge = app.querySelector<HTMLElement>("#offline");
    if (badge) badge.hidden = false;
  });
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  await loadLandmarker();
  const urls = [
    new URL("/", location.href).href,
    ...performance.getEntriesByType("resource").map((entry) => entry.name),
  ];
  (registration.active ?? navigator.serviceWorker.controller)?.postMessage({ type: "cache", urls });
}

show(startScreen);
setupOffline().catch(() => undefined);
