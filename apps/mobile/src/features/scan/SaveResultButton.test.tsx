import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult, type ScanResult } from "@app/core";
import { SaveResultButton } from "./SaveResultButton";

const mockDb = {};
let mockChildId: string | null | undefined;
const mockSave = jest.fn<Promise<void>, [unknown, ScanResult]>();
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../children/useActiveChildId", () => ({ useActiveChildId: () => mockChildId }));
jest.mock("../../storage/sessions", () => ({
  saveSession: (...args: [unknown, ScanResult]) => mockSave(...args),
}));
jest.mock("../../components/ui", () => ({ Text: "Text" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
}));

const real = mockScanResult("REFER", { modelVersion: "keypoints-1", childId: null });
let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const button = () => renderer.root.findAll((n) => (n.type as unknown) === "Pressable")[0]!;
async function render(result: ScanResult) {
  await act(async () => {
    renderer = create(<SaveResultButton result={result} />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
  mockChildId = "child-1";
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("saves a real result to the selected child once", async () => {
  mockSave.mockResolvedValue();
  await render(real);
  await act(async () => button().props.onPress());
  expect(mockSave).toHaveBeenCalledWith(mockDb, { ...real, childId: "child-1" });
  expect(text()).toContain("Saved to history");
  expect(button().props.disabled).toBe(true);
  await act(async () => button().props.onPress());
  expect(mockSave).toHaveBeenCalledTimes(1);
});

test("never saves a mock result", async () => {
  await render(mockScanResult("RETAKE"));
  expect(button().props.disabled).toBe(true);
  await act(async () => button().props.onPress());
  expect(mockSave).not.toHaveBeenCalled();
  expect(text()).toContain("Example results are not saved");
});

test("asks for a child profile first", async () => {
  mockChildId = null;
  await render(real);
  expect(button().props.disabled).toBe(true);
  expect(text()).toContain("Add a child profile");
});

test("lets the parent retry after a failed save", async () => {
  mockSave.mockRejectedValueOnce(new Error("db")).mockResolvedValue();
  await render(real);
  await act(async () => button().props.onPress());
  expect(text()).toContain("Could not save");
  expect(button().props.disabled).toBe(false);
  await act(async () => button().props.onPress());
  expect(text()).toContain("Saved to history");
});
