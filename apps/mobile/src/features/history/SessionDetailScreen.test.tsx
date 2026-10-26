import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult, type ScanResult } from "@app/core";
import SessionDetailScreen from "./SessionDetailScreen";
import { historyCopy } from "./copy";
import { outcomeCopy, reasonCopy } from "../scan/resultCopy";

const copy = historyCopy.detail;
const mockDb = {};
const mockGet = jest.fn<Promise<ScanResult | null>, [unknown, string]>();
const mockDelete = jest.fn<Promise<boolean>, [unknown, string]>();
const mockBack = jest.fn();
const mockAlert = jest.fn();
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => ({
  router: { back: () => mockBack() },
  useLocalSearchParams: () => ({ id: "scan-1" }),
}));
jest.mock("../../storage/sessions", () => ({
  getSession: (...args: [unknown, string]) => mockGet(...args),
  deleteSession: (...args: [unknown, string]) => mockDelete(...args),
}));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
}));
jest.mock("react-native", () => ({
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

type AlertAction = { style: string; onPress?: () => void };
let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const nodes = (type: string) => renderer.root.findAll((node) => node.type === type);
const button = (label: string) => nodes("Button").find((node) => node.props.label === label)!;
const confirm = async () => {
  await act(async () => button(copy.delete).props.onPress());
  const actions = mockAlert.mock.calls[0]![2] as AlertAction[];
  return () => act(async () => actions.find((a) => a.style === "destructive")!.onPress!());
};
async function render() {
  await act(async () => {
    renderer = create(<SessionDetailScreen />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("shows the outcome, reasons and frame counts of the saved scan", async () => {
  mockGet.mockResolvedValue(mockScanResult("RETAKE", { reasons: ["BLUR", "TOO_FEW_FRAMES"] }));
  await render();
  expect(mockGet).toHaveBeenCalledWith(mockDb, "scan-1");
  for (const expected of [outcomeCopy.RETAKE.title, reasonCopy.BLUR, reasonCopy.TOO_FEW_FRAMES]) {
    expect(text()).toContain(expected);
  }
  expect(text()).toContain("Frames used");
});

test("says when the scan no longer exists", async () => {
  mockGet.mockResolvedValue(null);
  await render();
  expect(text()).toContain(copy.missing);
  expect(button(copy.delete)).toBeUndefined();
});

test("deletes only after confirmation, then goes back", async () => {
  mockGet.mockResolvedValue(mockScanResult("REFER"));
  mockDelete.mockResolvedValue(true);
  await render();
  const destroy = await confirm();
  expect(mockDelete).not.toHaveBeenCalled();
  await destroy();
  expect(mockDelete).toHaveBeenCalledWith(mockDb, "scan-1");
  expect(mockBack).toHaveBeenCalled();
});

test("stays on the screen with a message when deleting fails", async () => {
  mockGet.mockResolvedValue(mockScanResult("REFER"));
  mockDelete.mockRejectedValue(new Error("db"));
  await render();
  await (
    await confirm()
  )();
  expect(text()).toContain(copy.deleteFailed);
  expect(mockBack).not.toHaveBeenCalled();
});
