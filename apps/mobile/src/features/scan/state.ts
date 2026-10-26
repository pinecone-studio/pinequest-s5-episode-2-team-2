import type { ScanResult } from "@app/core";

export const SCAN_DURATION_MS = 3000;
export type ScanState =
  | { status: "idle" | "aligning" | "processing" | "failed" }
  | { status: "scanning"; startedAtMs: number; elapsedMs: number }
  | { status: "done"; result: ScanResult };
export type ScanEvent =
  | { type: "ALIGN" | "CANCEL" | "FAIL" | "RETRY" }
  | { type: "START" | "TICK"; nowMs: number }
  | { type: "RESOLVE"; result: ScanResult };

export const initialScanState: ScanState = { status: "idle" };

export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  if (event.type === "CANCEL") return initialScanState;
  if (event.type === "FAIL" && state.status !== "done") return { status: "failed" };
  switch (state.status) {
    case "idle":
      return event.type === "ALIGN" ? { status: "aligning" } : state;
    case "aligning":
      return event.type === "START"
        ? { status: "scanning", startedAtMs: event.nowMs, elapsedMs: 0 }
        : state;
    case "scanning": {
      if (event.type !== "TICK") return state;
      const elapsedMs = Math.max(state.elapsedMs, event.nowMs - state.startedAtMs);
      return elapsedMs >= SCAN_DURATION_MS ? { status: "processing" } : { ...state, elapsedMs };
    }
    case "processing":
      return event.type === "RESOLVE" ? { status: "done", result: event.result } : state;
    case "failed":
      return event.type === "RETRY" ? { status: "aligning" } : state;
    default:
      return state;
  }
}

export function torchEnabled(state: ScanState, active: boolean, hasTorch: boolean): boolean {
  return active && hasTorch && (state.status === "aligning" || state.status === "scanning");
}
