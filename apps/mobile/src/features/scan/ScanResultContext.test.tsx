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
  const crop = { x: 0, y: 0, size: 200 };
  const photos = [
    { crop, pixels: new Uint8Array(3) },
    { crop, pixels: new Uint8Array(3) },
  ] as const;
  await act(async () => {
    context.setResult(mockScanResult("REFER"));
    context.setEyes(eyes);
    context.setPhotos(photos);
  });
  expect(context.eyes).toBe(eyes);
  expect(context.photos).toBe(photos);
  await act(async () => context.setResult(null));
  expect(context.eyes).toBeNull();
  expect(context.photos).toBeNull();
});
