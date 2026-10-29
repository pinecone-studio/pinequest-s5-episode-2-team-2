import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockEyeMeasure, mockScanResult, type Outcome, type ScanResult } from "@app/core";
import type { ResultEyes } from "./ScanResultContext";
import ResultScreen from "./ResultScreen";
import { outcomeCopy, reasonCopy, resultCopy as copy } from "./resultCopy";
import { SCAN_POLICY_VERSION } from "./scanPolicy";
import { mascotCopy } from "../../components/mascotCopy";

let mockResult: ScanResult | null;
let mockEyes: ResultEyes = null;
const mockSetResult = jest.fn();
const mockDismiss = jest.fn();
jest.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
jest.mock("./ScanResultContext", () => ({
  useScanResult: () => ({ result: mockResult, setResult: mockSetResult, eyes: mockEyes }),
}));
jest.mock("expo-router", () => ({
  router: { dismissTo: (...args: unknown[]) => mockDismiss(...args) },
}));
jest.mock("./SaveResultButton", () => ({ SaveResultButton: "SaveResultButton" }));
jest.mock("../eyeView/EyeDiagramView", () => ({ EyeDiagramView: "EyeDiagramView" }));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Notice: "Notice",
  Text: "Text",
  Verdict: "Verdict",
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
let renderer: ReactTestRenderer;
const nodes = (type: string) => renderer.root.findAll((node) => node.type === type);
const text = () => JSON.stringify(renderer.toJSON());
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
  mockResult = mockScanResult("RETAKE");
  mockEyes = null;
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
  },
);

test("missing results still show the notice and let the parent return to Scan", async () => {
  mockResult = null;
  await render();
  expect(text()).toContain(copy.empty);
  expect(text()).toContain(copy.notice);
  expect(nodes("SaveResultButton")).toHaveLength(0);
  await act(async () => nodes("Button")[0]!.props.onPress());
  expect(mockSetResult).toHaveBeenCalledWith(null);
  expect(mockDismiss).toHaveBeenCalledWith("/scan");
});

test("draws the measured eyes instead of the illustration when they are known", async () => {
  mockEyes = [mockEyeMeasure("imageLeft"), mockEyeMeasure("imageRight")];
  await render();
  expect(nodes("EyeDiagramView")).toHaveLength(1);
  expect(nodes("EyeDiagramView")[0]!.props.eyes).toBe(mockEyes);
  expect(text()).not.toContain(copy.illustration);
});

test("measured demo results retain the unvalidated-policy warning and saved status", async () => {
  mockResult = mockScanResult("NO_VISIBLE_SIGN", {
    modelVersion: "keypoints-local-unversioned",
    policyVersion: SCAN_POLICY_VERSION,
  });
  mockEyes = [mockEyeMeasure("imageLeft"), mockEyeMeasure("imageRight")];
  await render();
  expect(text()).toContain(copy.demo);
  expect(text()).toContain(copy.saved);
  expect(text()).toContain(copy.notice);
  expect(text()).not.toContain(copy.mock);
});

test.each<[Outcome, string]>([
  ["REFER", "celebrate"],
  ["NO_VISIBLE_SIGN", "celebrate"],
  ["RETAKE", "thinking"],
  ["NOT_ASSESSED", "thinking"],
])("%s shows the %s mascot; only a finished check thanks the child", async (outcome, variant) => {
  mockResult = mockScanResult(outcome);
  await render();
  const mascots = nodes("Mascot");
  expect(mascots).toHaveLength(1);
  expect(mascots[0]!.props.variant).toBe(variant);
  expect(text().includes(mascotCopy.thanks)).toBe(variant === "celebrate");
});
