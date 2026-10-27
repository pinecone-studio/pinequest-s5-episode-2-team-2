import { act } from "react";
import type * as React from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult } from "@app/core";
import { LatestScanCard } from "./LatestScanCard";
import { outcomeCopy } from "../scan/resultCopy";

const mockDb = {};
let mockChildId: string | null | undefined;
const mockGetChild = jest.fn();
const mockList = jest.fn();
const mockNavigate = jest.fn();
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof React>("react");
  return {
    router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock("../children/useActiveChildId", () => ({ useActiveChildId: () => mockChildId }));
jest.mock("../../storage/children", () => ({ getChild: (...a: unknown[]) => mockGetChild(...a) }));
jest.mock("../../storage/sessions", () => ({
  listSessions: (...a: unknown[]) => mockList(...a),
}));
jest.mock("../../components/ui", () => ({ Button: "Button", Card: "Card", Text: "Text" }));
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
async function render() {
  await act(async () => {
    renderer = create(<LatestScanCard />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
  mockChildId = "c1";
  mockGetChild.mockResolvedValue({ id: "c1", name: "Номин", birthYear: null, createdAt: "" });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("renders nothing without a child profile", async () => {
  mockChildId = null;
  await render();
  expect(renderer.toJSON()).toBeNull();
});

test("says there is no scan yet", async () => {
  mockList.mockResolvedValue([]);
  await render();
  expect(text()).toContain("Номин");
  expect(text()).toContain("Шалгалт хийгээгүй байна");
});

test("shows the newest scan and opens the history", async () => {
  mockList.mockResolvedValue([
    mockScanResult("REFER", { createdAt: new Date().toISOString() }),
    mockScanResult("NO_VISIBLE_SIGN", { id: "old" }),
  ]);
  await render();
  expect(mockList).toHaveBeenCalledWith(mockDb, "c1");
  expect(text()).toContain(outcomeCopy.REFER.title);
  expect(text()).toContain("Өнөөдөр шалгасан");
  await act(async () =>
    renderer.root.findAll((n) => n.props.label === "Түүх харах")[0]!.props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith("/history");
});
