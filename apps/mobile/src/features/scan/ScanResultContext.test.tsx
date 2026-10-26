import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockEyeMeasure, mockScanResult } from "@app/core";
import { ScanResultProvider, useScanResult } from "./ScanResultContext";

let context: ReturnType<typeof useScanResult>;
function Probe() {
  context = useScanResult();
  return null;
}

let renderer: ReactTestRenderer;
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("keeps the eyes with the result and drops them when the result is cleared", async () => {
  await act(async () => {
    renderer = create(
      <ScanResultProvider>
        <Probe />
      </ScanResultProvider>,
    );
  });
  const eyes = [mockEyeMeasure("imageLeft"), mockEyeMeasure("imageRight")] as const;
  await act(async () => {
    context.setResult(mockScanResult("REFER"));
    context.setEyes(eyes);
  });
  expect(context.eyes).toBe(eyes);
  await act(async () => context.setResult(null));
  expect(context.eyes).toBeNull();
});
