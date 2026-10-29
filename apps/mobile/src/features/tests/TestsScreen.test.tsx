import { act } from "react";
import type * as React from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult, type ScanResult } from "@app/core";
import type { AcuityResult } from "../../storage/acuity";
import TestsScreen from "./TestsScreen";
import { latestAcuityLine, latestScanLine } from "./checks";
import { testsCopy as copy } from "./copy";

let mockChildId: string | null | undefined;
const mockSessions = jest.fn<Promise<ScanResult[]>, [unknown, string]>();
const mockAcuity = jest.fn<Promise<AcuityResult[]>, [unknown, string]>();
const mockNavigate = jest.fn();
const mockDb = {};
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof React>("react");
  return {
    router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock("../children/useActiveChildId", () => ({ useActiveChildId: () => mockChildId }));
jest.mock("../../storage/sessions", () => ({
  listSessions: (...args: [unknown, string]) => mockSessions(...args),
}));
jest.mock("../../storage/acuity", () => ({
  listAcuityResults: (...args: [unknown, string]) => mockAcuity(...args),
}));
jest.mock("./pictures", () => ({
  CheckPicture: "CheckPicture",
  ACCENT: { strabismus: {}, vision: {} },
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
}));
jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const nodes = (type: string) => renderer.root.findAll((node) => node.type === type);
async function render() {
  await act(async () => {
    renderer = create(<TestsScreen />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
  mockChildId = "child-1";
  mockSessions.mockResolvedValue([]);
  mockAcuity.mockResolvedValue([]);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("shows a spinner on each card until the active profile is known", async () => {
  mockChildId = undefined;
  await render();
  expect(nodes("ActivityIndicator")).toHaveLength(2);
  expect(mockSessions).not.toHaveBeenCalled();
});

test("replaces the spinners with each check's latest result", async () => {
  const scan = { ...mockScanResult("REFER"), createdAt: new Date().toISOString() };
  mockSessions.mockResolvedValue([scan]);
  await render();
  expect(mockSessions).toHaveBeenCalledWith(mockDb, "child-1");
  expect(nodes("ActivityIndicator")).toHaveLength(0);
  expect(text()).toContain(latestScanLine([scan]));
  expect(text()).toContain(latestAcuityLine([]));
});

test("shows no result line without a profile", async () => {
  mockChildId = null;
  await render();
  expect(nodes("ActivityIndicator")).toHaveLength(0);
  expect(text()).not.toContain(copy.notYet);
});

test("draws each check and lists what it needs", async () => {
  await render();
  expect(nodes("CheckPicture").map((n) => n.props.id)).toEqual(["strabismus", "vision"]);
  const { strabismus, vision } = copy.checks;
  for (const label of [strabismus.time, strabismus.distance, strabismus.light, vision.time]) {
    expect(text()).toContain(label);
  }
});

test("starts the scan with the preparation steps and the vision check directly", async () => {
  await render();
  const [scan, vision] = nodes("Button");
  await act(async () => scan!.props.onPress());
  await act(async () => vision!.props.onPress());
  expect(mockNavigate.mock.calls).toEqual([["/prepare"], ["/acuity"]]);
});
