import { loadLandmarker, startCamera, stopCamera } from "./scanner";
import { t } from "./strings";

// Tumbling-E distance acuity check. Optotype size follows the logMAR definition: the letter
// is 5 strokes tall and subtends 5 × 10^logMAR arcminutes at the test distance.

export interface Screens {
  app: HTMLDivElement;
  show: (screen: () => void) => void;
  setCleanup: (fn: () => void) => void;
  home: () => void;
  icon: Record<string, string>;
}

type Group = "child3" | "child4" | "child5" | "adult";
type Eye = "right" | "left";
type Direction = 0 | 90 | 180 | 270;

const TEST_DISTANCE_MM = 2000;
// ISO/IEC 7810 ID-1 bank card, drawn upright so it fits a phone screen.
const CARD_MM = { short: 53.98, long: 85.6 };
const LEVELS = [1.0, 0.7, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];
const PER_LEVEL = 3;
/** Line to pass, in logMAR: AAPOS screening lines for children; WHO ICD-11 mild impairment for adults. */
const PASS_LINE: Record<Group, number> = { child3: 0.4, child4: 0.3, child5: 0.2, adult: 0.3 };
// TODO(tune): rough distance guide only. Assumed front-camera field of view and an adult
// interpupillary distance (about 63 mm, Dodgson 2004); children read closer than they are.
const ASSUMED_HFOV_DEG = 60;
const ADULT_IPD_MM = 63;

const STORAGE_KEY = "acuity.pxPerMm";

function storedPxPerMm(): number | null {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

function storePxPerMm(v: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    // Calibration then lasts for this visit only.
  }
}

function optotypePx(logMar: number, pxPerMm: number): number {
  const arcmin = 5 * 10 ** logMar;
  return TEST_DISTANCE_MM * Math.tan((arcmin / 60) * (Math.PI / 180)) * pxPerMm;
}

function decimal(logMar: number): string {
  return (10 ** -logMar).toFixed(logMar >= 0.95 ? 1 : 2).replace(/0$/, "");
}

const E_SVG =
  '<svg viewBox="0 0 5 5" aria-hidden="true"><path d="M0 0h5v1H1v1h4v1H1v1h4v1H0z" fill="currentColor"/></svg>';

export function acuityFlow(s: Screens) {
  const { app, show, icon } = s;
  const on = (sel: string, fn: () => void) => app.querySelector(sel)?.addEventListener("click", fn);
  const header = (title: string) => `
    <header class="page-head">
      <button class="round plain" id="back" aria-label="${t.back}">${icon.back}</button>
      <h1>${title}</h1>
    </header>`;

  let group: Group = "adult";
  let pxPerMm = storedPxPerMm();
  const results: Partial<Record<Eye, number | null>> = {};

  function who() {
    app.innerHTML = `
      <main class="screen page">
        ${header(t.acuity.title)}
        <section class="card plain-text"><p>${t.acuity.intro}</p></section>
        <h3 class="section-label">${t.acuity.who}</h3>
        <div class="choice-grid">
          <button class="choice" data-g="child3">${t.acuity.groups.child3}</button>
          <button class="choice" data-g="child4">${t.acuity.groups.child4}</button>
          <button class="choice" data-g="child5">${t.acuity.groups.child5}</button>
          <button class="choice" data-g="adult">${t.acuity.groups.adult}</button>
        </div>
        <p class="notice">${icon.info}<span>${t.acuity.under3}</span></p>
      </main>`;
    on("#back", () => show(s.home));
    app.querySelectorAll<HTMLButtonElement>(".choice").forEach((b) =>
      b.addEventListener("click", () => {
        group = b.dataset.g as Group;
        show(pxPerMm ? distance : calibrate);
      }),
    );
  }

  function calibrate() {
    const initial = pxPerMm ?? 6;
    app.innerHTML = `
      <main class="screen page">
        ${header(t.acuity.calibrateTitle)}
        <section class="card plain-text"><p>${t.acuity.calibrateHelp}</p></section>
        <div class="card-outline" id="card"></div>
        <label class="slider-label" for="size">${t.acuity.calibrateSlider}</label>
        <input id="size" type="range" min="3" max="12" step="0.01" value="${initial}" />
        <div class="spacer"></div>
        <div class="actions"><button class="btn primary" id="ok">${t.acuity.calibrateDone}</button></div>
      </main>`;
    const card = app.querySelector<HTMLDivElement>("#card")!;
    const slider = app.querySelector<HTMLInputElement>("#size")!;
    const draw = () => {
      const v = Number(slider.value);
      card.style.width = `${CARD_MM.short * v}px`;
      card.style.height = `${CARD_MM.long * v}px`;
    };
    slider.addEventListener("input", draw);
    draw();
    on("#back", () => show(who));
    on("#ok", () => {
      pxPerMm = Number(slider.value);
      storePxPerMm(pxPerMm);
      show(distance);
    });
  }

  function distance() {
    app.innerHTML = `
      <main class="screen distance">
        <div class="distance-top">
          <button class="round" id="back" aria-label="${t.back}">${icon.back}</button>
          <video id="video" playsinline muted autoplay></video>
        </div>
        <div class="distance-status" id="status">
          <strong id="headline">${t.loading}</strong>
          <span id="meters"></span>
        </div>
        <p class="distance-help">${t.acuity.distanceHelp}</p>
        <div class="actions">
          <button class="btn primary" id="ok">${t.acuity.distanceOk}</button>
          <button class="btn link" id="recal">${t.acuity.recalibrate}</button>
        </div>
      </main>`;
    const video = app.querySelector<HTMLVideoElement>("#video")!;
    const box = app.querySelector<HTMLDivElement>("#status")!;
    const headline = app.querySelector<HTMLElement>("#headline")!;
    const meters = app.querySelector<HTMLElement>("#meters")!;
    let running = true;
    s.setCleanup(() => {
      running = false;
      stopCamera(video);
    });
    on("#back", () => show(who));
    on("#recal", () => show(calibrate));
    on("#ok", () => show(() => cover("right")));

    Promise.all([startCamera(video, "user"), loadLandmarker()])
      .then(([, faces]) => {
        const tick = () => {
          if (!running) return;
          if (video.readyState >= 2) {
            const lm = faces.detectForVideo(video, performance.now()).faceLandmarks[0];
            const a = lm?.[468];
            const b = lm?.[473];
            let state: keyof typeof t.acuity.distance = "noFace";
            if (a && b) {
              const ipdPx = Math.hypot(
                (a.x - b.x) * video.videoWidth,
                (a.y - b.y) * video.videoHeight,
              );
              const focalPx =
                Math.max(video.videoWidth, video.videoHeight) /
                2 /
                Math.tan(((ASSUMED_HFOV_DEG / 2) * Math.PI) / 180);
              const mm = (focalPx * ADULT_IPD_MM) / ipdPx;
              state =
                mm < TEST_DISTANCE_MM * 0.85
                  ? "back"
                  : mm > TEST_DISTANCE_MM * 1.15
                    ? "closer"
                    : "ok";
              meters.textContent = `≈ ${(mm / 1000).toFixed(1)} м`;
            } else {
              meters.textContent = "";
            }
            headline.textContent = t.acuity.distance[state];
            box.dataset.state = state;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })
      .catch(() => {
        headline.textContent = t.acuity.noCamera;
        box.dataset.state = "noFace";
      });
  }

  function cover(eye: Eye) {
    app.innerHTML = `
      <main class="screen page center">
        ${header(eye === "right" ? t.acuity.rightEye : t.acuity.leftEye)}
        <h2 class="big">${eye === "right" ? t.acuity.coverLeft : t.acuity.coverRight}</h2>
        <p class="lead">${t.acuity.howToAnswer}</p>
        <div class="spacer"></div>
        <div class="actions"><button class="btn primary" id="ok">${t.acuity.ready}</button></div>
      </main>`;
    on("#back", () => show(who));
    on("#ok", () => show(() => test(eye)));
  }

  function test(eye: Eye) {
    let level = 0;
    let shown = 0;
    let correct = 0;
    let passed: number | null = null;
    let direction: Direction = 0;

    app.innerHTML = `
      <main class="screen test">
        <div class="test-top">
          <button class="round plain" id="back" aria-label="${t.back}">${icon.back}</button>
          <span id="progress"></span>
        </div>
        <div class="optotype" id="e">${E_SVG}</div>
        <div class="answers">
          <button class="arrow up" data-d="270" aria-label="${t.acuity.up}">↑</button>
          <button class="arrow left" data-d="180" aria-label="${t.acuity.left}">←</button>
          <button class="arrow right" data-d="0" aria-label="${t.acuity.right}">→</button>
          <button class="arrow down" data-d="90" aria-label="${t.acuity.down}">↓</button>
        </div>
        <button class="btn outline" id="cant">${t.acuity.cantSee}</button>
      </main>`;
    const e = app.querySelector<HTMLDivElement>("#e")!;
    const progress = app.querySelector<HTMLElement>("#progress")!;

    const next = () => {
      const dirs: Direction[] = [0, 90, 180, 270];
      let d = dirs[Math.floor(Math.random() * 4)]!;
      if (d === direction) d = dirs[(dirs.indexOf(d) + 1 + Math.floor(Math.random() * 3)) % 4]!;
      direction = d;
      const size = optotypePx(LEVELS[level]!, pxPerMm ?? 6);
      e.style.width = `${size}px`;
      e.style.height = `${size}px`;
      e.style.transform = `rotate(${direction}deg)`;
      progress.textContent = t.acuity.progress(level + 1, LEVELS.length);
    };

    const answer = (d: Direction | null) => {
      shown += 1;
      if (d === direction) correct += 1;
      const majority = Math.floor(PER_LEVEL / 2) + 1;
      if (correct >= majority || shown - correct > PER_LEVEL - majority) {
        if (correct >= majority) passed = LEVELS[level]!;
        const done = correct < majority || level === LEVELS.length - 1;
        if (done) {
          results[eye] = passed;
          show(eye === "right" ? () => cover("left") : result);
          return;
        }
        level += 1;
        shown = 0;
        correct = 0;
      }
      next();
    };

    app
      .querySelectorAll<HTMLButtonElement>(".arrow")
      .forEach((b) => b.addEventListener("click", () => answer(Number(b.dataset.d) as Direction)));
    on("#cant", () => answer(null));
    on("#back", () => show(who));
    next();
  }

  function result() {
    const line = PASS_LINE[group];
    const eyes: Eye[] = ["right", "left"];
    const refer = eyes.some((eye) => {
      const v = results[eye];
      return v === null || v === undefined || v > line + 1e-9;
    });
    const row = (eye: Eye) => {
      const v = results[eye];
      const value = v === null || v === undefined ? t.acuity.belowChart : decimal(v);
      return `<div><span>${eye === "right" ? t.acuity.rightEye : t.acuity.leftEye}</span><strong>${value}</strong></div>`;
    };
    const copy = refer ? t.acuity.refer : t.acuity.noSign;
    app.innerHTML = `
      <main class="screen page">
        ${header(t.acuity.resultTitle)}
        <section class="card verdict ${refer ? "refer" : "no_visible_sign"}">
          <span class="verdict-dot" aria-hidden="true"></span>
          <div><h2>${copy.title}</h2><p>${copy.body}</p></div>
        </section>
        <section class="card">
          <div class="stats">${row("right")}${row("left")}</div>
          <p class="hint">${t.acuity.scaleHint}</p>
        </section>
        <section class="card plain-text">
          <h3>${t.whatNext}</h3>
          <ul>${copy.next.map((l) => `<li>${l}</li>`).join("")}</ul>
        </section>
        <details class="card details">
          <summary>${t.details}</summary>
          <p class="hint">${t.acuity.method(decimal(line))}</p>
        </details>
        <p class="notice">${icon.info}<span>${t.acuity.notice}</span></p>
        <div class="spacer"></div>
        <div class="actions">
          <button class="btn primary" id="again">${t.acuity.again}</button>
          <button class="btn outline" id="home">${t.acuity.home}</button>
        </div>
      </main>`;
    on("#back", () => show(s.home));
    on("#home", () => show(s.home));
    on("#again", () => show(who));
  }

  return who;
}
