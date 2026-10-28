import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult, type ScanResult } from "@app/core";
import { formatDay } from "../history/format";
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

test("dates the first and last measured scans under the time axis (#236)", async () => {
  await render([scan("c", 24, 0.3), scan("b", 26, null), scan("a", 20, 0.1)]);
  const first = formatDay("2026-10-20T03:00:00.000Z");
  const last = formatDay("2026-10-24T03:00:00.000Z");
  expect(text()).toContain(first);
  expect(text()).toContain(last);
  // The unmeasured scan on the 26th is not on the chart, so its day is not either.
  expect(text()).not.toContain(formatDay("2026-10-26T03:00:00.000Z"));
});

test("shows one date when every measured scan is from the same day", async () => {
  await render([scan("a", 20, 0.1), scan("b", 20, 0.2)]);
  const day = formatDay("2026-10-20T03:00:00.000Z");
  expect(text().split(day)).toHaveLength(2);
});
