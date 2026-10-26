import { act } from "react";
import type * as React from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult, type ScanResult } from "@app/core";
import HistoryScreen from "./HistoryScreen";
import { historyCopy as copy } from "./copy";
import { outcomeCopy } from "../scan/resultCopy";

let mockChildId: string | null | undefined;
const mockList = jest.fn<Promise<ScanResult[]>, [unknown, string]>();
const mockPush = jest.fn();
const mockDb = {};
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof React>("react");
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock("../children/useActiveChildId", () => ({ useActiveChildId: () => mockChildId }));
jest.mock("../../storage/sessions", () => ({
  listSessions: (...args: [unknown, string]) => mockList(...args),
}));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
}));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const nodes = (type: string) => renderer.root.findAll((node) => node.type === type);
async function render() {
  await act(async () => {
    renderer = create(<HistoryScreen />);
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

test("asks for a child profile when there is none", async () => {
  mockChildId = null;
  await render();
  expect(text()).toContain(copy.noChild);
  expect(mockList).not.toHaveBeenCalled();
});

test("shows the empty state", async () => {
  mockList.mockResolvedValue([]);
  await render();
  expect(mockList).toHaveBeenCalledWith({}, "child-1");
  expect(text()).toContain(copy.empty);
});

test("lists sessions by day and opens one", async () => {
  mockList.mockResolvedValue([
    mockScanResult("REFER", { id: "b", createdAt: new Date(2026, 9, 26, 14, 5).toISOString() }),
    mockScanResult("RETAKE", { id: "a", createdAt: new Date(2026, 9, 25, 9, 0).toISOString() }),
  ]);
  await render();
  expect(text()).toContain("2026.10.26");
  expect(text()).toContain("2026.10.25");
  expect(text()).toContain(outcomeCopy.REFER.title);
  const rows = nodes("Pressable");
  expect(rows).toHaveLength(2);
  await act(async () => rows[0]!.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/session/[id]", params: { id: "b" } });
});

test("offers a retry when loading fails", async () => {
  mockList.mockRejectedValueOnce(new Error("db")).mockResolvedValue([]);
  await render();
  expect(text()).toContain(copy.failed);
  const [retry] = nodes("Button");
  await act(async () => retry!.props.onPress());
  expect(text()).toContain(copy.empty);
});
