import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult, type ScanResult } from "@app/core";
import { ProgressChart } from "./ProgressChart";
import { progressCopy as copy } from "./copy";

jest.mock("../../components/ui", () => ({ Text: "Text" }));
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

const scan = (id: string, day: number, score: number | null): ScanResult => {
  const base = mockScanResult(score === null ? "RETAKE" : "NO_VISIBLE_SIGN", {
    id,
    createdAt: `2026-10-${day}T03:00:00.000Z`,
  });
  return { ...base, summary: { ...base.summary, asymmetryScore: score } };
};

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const plot = () =>
  renderer.root.findAll((node) => (node.type as unknown) === "View" && !!node.props.onLayout)[0];
async function render(sessions: ScanResult[]) {
  await act(async () => {
    renderer = create(<ProgressChart sessions={sessions} />);
  });
}
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("waits for two measured scans and always shows the notice", async () => {
  await render([scan("a", 20, 0.1), scan("b", 21, null)]);
  expect(text()).toContain(copy.notEnough);
  expect(text()).toContain(copy.notice);
  expect(plot()).toBeUndefined();
});

test("draws one dot per measured scan and one line between each pair", async () => {
  await render([scan("c", 24, 0.3), scan("b", 22, null), scan("a", 20, 0.1), scan("d", 26, 0.2)]);
  await act(async () => plot()!.props.onLayout({ nativeEvent: { layout: { width: 212 } } }));
  const children = plot()!.children as ReactTestRenderer["root"][];
  expect(children).toHaveLength(3 + 2);
  expect(plot()!.props.accessibilityLabel).toBe(copy.summary(3, 0.3));
});
