jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult, type Outcome } from "@app/core";
import { ScanCards } from "./ScanCards";
import { dashboardCopy as copy } from "./copy";
import { outcomeCopy, resultCopy } from "../scan/resultCopy";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock("../../components/ui", () => ({ Text: "Text", Card: "Card" }));
jest.mock("../progress/ProgressChart", () => ({ ProgressChart: "ProgressChart" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (s: unknown) => s },
}));
let renderer: ReactTestRenderer;
const details = (outcome?: Outcome) => ({
  childId: "a",
  sessions: [],
  latestScan: outcome ? { ...mockScanResult(outcome), id: "saved" } : null,
});
async function render(data: ReturnType<typeof details>) {
  await act(async () => {
    renderer = create(<ScanCards details={data} />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockPush.mockClear();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test.each<Outcome>(["REFER", "RETAKE", "NOT_ASSESSED", "NO_VISIBLE_SIGN"])(
  "preserves %s wording and opens the saved scan",
  async (outcome) => {
    await render(details(outcome));
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain(outcomeCopy[outcome].title);
    expect(text).toContain(resultCopy.notice);
    renderer.root.findByProps({ accessibilityLabel: `${copy.scan}: ${copy.open}` }).props.onPress();
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/session/[id]", params: { id: "saved" } });
  },
);

test("empty scan opens checks for this child and chart still opens their history", async () => {
  await render(details());
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.noScan);
  renderer.root.findByProps({ accessibilityLabel: `${copy.scan}: ${copy.open}` }).props.onPress();
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/tests", params: { childId: "a" } });
  renderer.root
    .findByProps({ accessibilityLabel: `${copy.progress}: ${copy.open}` })
    .props.onPress();
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/history", params: { childId: "a" } });
  expect(renderer.root.findByType("ProgressChart" as never).props.sessions).toEqual([]);
});
