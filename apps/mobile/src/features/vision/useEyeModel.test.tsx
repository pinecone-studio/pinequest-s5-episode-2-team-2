import { act } from "react";
import { create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { useEyeModel } from "./useEyeModel";

const mockLoad = jest.fn();
jest.mock("react-native-fast-tflite", () => ({
  loadTensorflowModel: (...args: unknown[]) => mockLoad(...args),
}));
let uri: string | undefined;
let latest: ReturnType<typeof useEyeModel>;
function Harness() {
  latest = useEyeModel(uri);
  return null;
}
function model() {
  return {
    inputs: [{ dataType: "float32", shape: [1, 128, 128, 3] }],
    outputs: [{ dataType: "float32", shape: [1, 6] }],
    dispose: jest.fn(),
  };
}
let renderer: ReactTestRenderer;
beforeEach(async () => {
  mockLoad.mockReset();
  uri = undefined;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => {
    renderer = create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

test("no released weights means unavailable; remote URLs are rejected", async () => {
  expect(latest.model).toBeUndefined();
  expect(mockLoad).not.toHaveBeenCalled();
  uri = "https://example.com/keypoints.tflite";
  await act(async () => renderer.update(<Harness />));
  expect(latest.error).toBe(true);
  expect(mockLoad).not.toHaveBeenCalled();
});

test("loads a local CPU model only after validating the six-output contract", async () => {
  const ready = model();
  mockLoad.mockResolvedValue(ready);
  uri = "file:///private/keypoints.tflite";
  await act(async () => renderer.update(<Harness />));
  expect(latest.model).toBe(ready);
  expect(latest.error).toBe(false);
  expect(mockLoad).toHaveBeenCalledWith({ url: uri }, []);
  const wrong = model();
  wrong.outputs[0]!.shape = [1, 100];
  mockLoad.mockResolvedValue(wrong);
  uri = "file:///private/wrong.tflite";
  await act(async () => renderer.update(<Harness />));
  expect(latest.model).toBeUndefined();
  expect(latest.error).toBe(true);
  expect(wrong.dispose).toHaveBeenCalledTimes(1);
});

test("a failed file load is reported without crashing", async () => {
  mockLoad.mockRejectedValue(new Error("missing"));
  uri = "file:///missing.tflite";
  await act(async () => renderer.update(<Harness />));
  expect(latest.error).toBe(true);
  expect(latest.model).toBeUndefined();
});

test("unmount disposes a model that finishes loading late", async () => {
  let complete!: (value: ReturnType<typeof model>) => void;
  mockLoad.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  uri = "file:///private/keypoints.tflite";
  await act(async () => renderer.update(<Harness />));
  await act(async () => renderer.unmount());
  const late = model();
  await act(async () => complete(late));
  expect(late.dispose).toHaveBeenCalledTimes(1);
});
