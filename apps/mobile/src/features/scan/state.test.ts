import { mockScanResult } from "@app/core";
import { initialScanState, scanReducer, torchEnabled } from "./state";
import type { ScanState } from "./state";

const aligning = scanReducer(initialScanState, { type: "ALIGN" });
const scanning = scanReducer(aligning, { type: "START", nowMs: 100 });
const processing = scanReducer(scanning, { type: "TICK", nowMs: 3100 });
const result = mockScanResult("RETAKE");
const done = scanReducer(processing, { type: "RESOLVE", result });

test("aligns, scans for three seconds, processes, then retains the mock result", () => {
  expect(aligning.status).toBe("aligning");
  expect(scanReducer(scanning, { type: "TICK", nowMs: 3099 }).status).toBe("scanning");
  expect(processing.status).toBe("processing");
  expect(done).toEqual({ status: "done", result });
});

test.each([aligning, scanning, processing, done])(
  "cancel resets $status and ignores late completion",
  (state) => {
    const cancelled = scanReducer(state, { type: "CANCEL" });
    expect(cancelled).toEqual(initialScanState);
    expect(scanReducer(cancelled, { type: "RESOLVE", result })).toEqual(initialScanState);
    expect(scanReducer(cancelled, { type: "TICK", nowMs: 5000 })).toEqual(initialScanState);
    expect(torchEnabled(cancelled, true, true)).toBe(false);
  },
);

test.each([aligning, scanning, processing])(
  "failure during $status allows retry and cancellation",
  (state) => {
    const failed = scanReducer(state, { type: "FAIL" });
    expect(failed.status).toBe("failed");
    expect(scanReducer(failed, { type: "RESOLVE", result })).toBe(failed);
    expect(scanReducer(failed, { type: "RETRY" })).toEqual(aligning);
    expect(scanReducer(failed, { type: "CANCEL" })).toEqual(initialScanState);
    expect(torchEnabled(failed, true, true)).toBe(false);
  },
);

test("double starts and early results cannot shorten a scan; progress never goes backwards", () => {
  const tick = scanReducer(scanning, { type: "TICK", nowMs: 600 });
  expect(scanReducer(tick, { type: "START", nowMs: 600 })).toBe(tick);
  expect(scanReducer(tick, { type: "RESOLVE", result })).toBe(tick);
  expect(scanReducer(tick, { type: "TICK", nowMs: 200 })).toEqual(tick);
  expect(scanReducer(done, { type: "FAIL" })).toBe(done);
});

test.each<ScanState>([
  initialScanState,
  aligning,
  scanning,
  processing,
  done,
  { status: "failed" },
])("torch is limited to active aligning/scanning states ($status)", (state) => {
  expect(torchEnabled(state, true, true)).toBe(["aligning", "scanning"].includes(state.status));
  expect(torchEnabled(state, false, true)).toBe(false);
  expect(torchEnabled(state, true, false)).toBe(false);
});
