import { act } from "react";
import type * as React from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult, type ScanResult } from "@app/core";
import HistoryScreen from "./HistoryScreen";
import { historyCopy as copy } from "./copy";
import { childrenCopy } from "../children/copy";
import { progressCopy } from "../progress/copy";
import { outcomeCopy } from "../scan/resultCopy";

let mockChildId: string | null | undefined;
const mockList = jest.fn<Promise<ScanResult[]>, [unknown, string | null]>();
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
  listSessions: (...args: [unknown, string | null]) => mockList(...args),
}));
jest.mock("../../components/EmptyState", () => ({ EmptyState: "EmptyState", Loading: "Loading" }));
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

test("asks for a child profile when there are no unassigned scans", async () => {
  mockChildId = null;
  mockList.mockResolvedValue([]);
  await render();
  expect(text()).toContain(copy.noChild);
  expect(mockList).toHaveBeenCalledWith(mockDb, null);
  // The empty state leads to adding a child (#237).
  const empty = renderer.root.findByType("EmptyState" as never);
  expect(empty.props.action.label).toBe(childrenCopy.add);
  await act(async () => empty.props.action.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/child/[id]", params: { id: "new" } });
});

test("waits for the active profile before loading history", async () => {
  mockChildId = undefined;
  await render();
  expect(mockList).not.toHaveBeenCalled();
});

test("opens a saved scan without a profile and does not combine it into progress", async () => {
  mockChildId = null;
  mockList.mockResolvedValue([mockScanResult("RETAKE", { id: "unassigned", childId: null })]);
  await render();
  expect(mockList).toHaveBeenCalledWith(mockDb, null);
  expect(text()).toContain(outcomeCopy.RETAKE.title);
  expect(text()).not.toContain(copy.noChild);
  expect(text()).not.toContain(progressCopy.notice);
  const rows = nodes("Pressable").filter((n) => n.props.accessibilityRole === "button");
  expect(rows).toHaveLength(1);
  await act(async () => rows[0]!.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/session/[id]",
    params: { id: "unassigned" },
  });
});

test("hides the previous profile's rows while unassigned history is loading", async () => {
  mockList.mockResolvedValueOnce([mockScanResult("REFER", { id: "child-scan" })]);
  await render();
  expect(text()).toContain(outcomeCopy.REFER.title);
  let resolve!: (rows: ScanResult[]) => void;
  mockList.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
  mockChildId = null;
  await act(async () => renderer.update(<HistoryScreen />));
  expect(text()).not.toContain(outcomeCopy.REFER.title);
  await act(async () => resolve([mockScanResult("RETAKE", { childId: null })]));
  expect(text()).toContain(outcomeCopy.RETAKE.title);
  expect(text()).not.toContain(outcomeCopy.REFER.title);
});

test("shows the empty state", async () => {
  mockList.mockResolvedValue([]);
  await render();
  expect(mockList).toHaveBeenCalledWith({}, "child-1");
  expect(text()).toContain(copy.empty);
  const empty = renderer.root.findByType("EmptyState" as never);
  await act(async () => empty.props.action.onPress());
  expect(mockPush).toHaveBeenCalledWith("/scan");
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
  expect(text()).toContain(progressCopy.notice);
  const rows = nodes("Pressable").filter((n) => n.props.accessibilityRole === "button");
  expect(rows).toHaveLength(2);
  await act(async () => rows[0]!.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/session/[id]", params: { id: "b" } });
});

test("filters the list by outcome", async () => {
  mockList.mockResolvedValue([
    mockScanResult("REFER", { id: "b", createdAt: new Date(2026, 9, 26, 14, 5).toISOString() }),
    mockScanResult("RETAKE", { id: "a", createdAt: new Date(2026, 9, 25, 9, 0).toISOString() }),
  ]);
  await render();
  const tab = nodes("Pressable").find(
    (n) => n.props.accessibilityLabel === `${outcomeCopy.RETAKE.title}: 1`,
  );
  await act(async () => tab!.props.onPress());
  const rows = nodes("Pressable").filter((n) => n.props.accessibilityRole === "button");
  expect(rows).toHaveLength(1);
  expect(text()).not.toContain("2026.10.26");
});

test("offers a retry when loading fails", async () => {
  mockList.mockRejectedValueOnce(new Error("db")).mockResolvedValue([]);
  await render();
  expect(text()).toContain(copy.failed);
  const [retry] = nodes("Button");
  await act(async () => retry!.props.onPress());
  expect(text()).toContain(copy.empty);
});
