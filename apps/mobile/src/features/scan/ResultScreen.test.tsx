import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult, type Outcome, type ScanResult } from "@app/core";
import ResultScreen from "./ResultScreen";
import { outcomeCopy, reasonCopy, resultCopy as copy } from "./resultCopy";

let mockResult: ScanResult | null;
const mockSetResult = jest.fn();
const mockDismiss = jest.fn();
const mockSave = jest.fn();
const mockDb = {};
jest.mock("./ScanResultContext", () => ({
  useScanResult: () => ({ result: mockResult, setResult: mockSetResult }),
}));
jest.mock("expo-router", () => ({
  router: { dismissTo: (...args: unknown[]) => mockDismiss(...args) },
}));
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../../storage/sessions", () => ({
  saveSession: (...args: unknown[]) => mockSave(...args),
}));
jest.mock("../../components/ui", () => ({ Button: "Button", Text: "Text" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
let renderer: ReactTestRenderer;
const nodes = (type: string) => renderer.root.findAll((node) => node.type === type);
const saveButton = () =>
  nodes("Pressable").find((node) => node.props.accessibilityLabel === copy.save)!;
const text = () => JSON.stringify(renderer.toJSON());
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
  mockSave.mockResolvedValue(undefined);
  mockResult = mockScanResult("RETAKE");
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
async function render() {
  await act(async () => {
    renderer = create(<ResultScreen />);
  });
}

test.each<Outcome>(["REFER", "RETAKE", "NOT_ASSESSED", "NO_VISIBLE_SIGN"])(
  "%s has an icon, title, explanation, next step and eye-exam notice",
  async (outcome) => {
    mockResult = mockScanResult(outcome);
    await render();
    for (const expected of [
      outcomeCopy[outcome].icon,
      outcomeCopy[outcome].title,
      outcomeCopy[outcome].explanation,
      outcomeCopy[outcome].next,
      copy.notice,
      copy.mock,
    ])
      expect(text()).toContain(expected);
    for (const reason of mockResult.reasons) expect(text()).toContain(reasonCopy[reason]);
    expect(mockSave).not.toHaveBeenCalled();
  },
);

test("duplicate save taps produce one write and announce success only after it completes", async () => {
  let complete!: () => void;
  mockSave.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  await render();
  await act(async () => {
    const press = saveButton().props.onPress;
    press();
    press();
  });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledWith(mockDb, mockResult);
  expect(saveButton().props.disabled).toBe(true);
  expect(text()).toContain(copy.saving);
  await act(async () => complete());
  expect(text()).toContain(copy.saved);
  await act(async () => saveButton().props.onPress());
  expect(mockSave).toHaveBeenCalledTimes(1);
});

test("save failures are visible and can be retried", async () => {
  mockSave.mockRejectedValueOnce(new Error("disk full"));
  await render();
  await act(async () => saveButton().props.onPress());
  expect(text()).toContain(copy.failed);
  expect(saveButton().props.disabled).toBe(false);
  await act(async () => saveButton().props.onPress());
  expect(text()).toContain(copy.saved);
  expect(text()).not.toContain(copy.failed);
});

test("a late save completion cannot mark a different scan as saved", async () => {
  let finishOld!: () => void;
  let finishNew!: () => void;
  mockSave.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishOld = resolve;
    }),
  );
  mockSave.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishNew = resolve;
    }),
  );
  await render();
  await act(async () => saveButton().props.onPress());
  mockResult = mockScanResult("REFER");
  await act(async () => renderer.update(<ResultScreen />));
  await act(async () => saveButton().props.onPress());
  await act(async () => finishOld());
  expect(text()).toContain(copy.saving);
  expect(text()).not.toContain(copy.saved);
  await act(async () => finishNew());
  expect(text()).toContain(copy.saved);
});

test("an unassigned scan is labelled before saving and a new result starts unsaved", async () => {
  mockResult = mockScanResult("RETAKE", { childId: null });
  await render();
  expect(text()).toContain(copy.unassigned);
  await act(async () => saveButton().props.onPress());
  mockResult = mockScanResult("REFER");
  await act(async () => renderer.update(<ResultScreen />));
  expect(text()).not.toContain(copy.saved);
  expect(saveButton().props.disabled).toBe(false);
});

test("missing results still show the notice and let the parent return to Scan", async () => {
  mockResult = null;
  await render();
  expect(text()).toContain(copy.empty);
  expect(text()).toContain(copy.notice);
  expect(renderer.root.findAll((node) => node.props.accessibilityLabel === copy.save)).toHaveLength(
    0,
  );
  await act(async () => nodes("Button")[0]!.props.onPress());
  expect(mockSetResult).toHaveBeenCalledWith(null);
  expect(mockDismiss).toHaveBeenCalledWith("/scan");
});
