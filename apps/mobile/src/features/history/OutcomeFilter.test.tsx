import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockScanResult } from "@app/core";
import { historyCopy as copy } from "./copy";
import { filterSessions, OutcomeFilter } from "./OutcomeFilter";
import { outcomeCopy } from "../scan/resultCopy";

jest.mock("../../components/ui", () => ({ Text: "Text" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

const sessions = [
  mockScanResult("REFER", { id: "a" }),
  mockScanResult("RETAKE", { id: "b" }),
  mockScanResult("RETAKE", { id: "c" }),
];
let renderer: ReactTestRenderer;
const tabs = () => renderer.root.findAll((n) => (n.type as unknown) === "Pressable");
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("filters by outcome, or keeps everything for null", () => {
  expect(filterSessions(sessions, "RETAKE").map((s) => s.id)).toEqual(["b", "c"]);
  expect(filterSessions(sessions, "NO_VISIBLE_SIGN")).toEqual([]);
  expect(filterSessions(sessions, null)).toEqual(sessions);
});

test("offers All and one chip per outcome present, with counts", async () => {
  const onSelect = jest.fn();
  await act(async () => {
    renderer = create(<OutcomeFilter sessions={sessions} selected={null} onSelect={onSelect} />);
  });
  expect(tabs().map((t) => t.props.accessibilityLabel)).toEqual([
    copy.all(3),
    `${outcomeCopy.REFER.title}: 1`,
    `${outcomeCopy.RETAKE.title}: 2`,
  ]);
  expect(tabs().map((t) => t.props.accessibilityState.selected)).toEqual([true, false, false]);
  await act(async () => tabs()[2]!.props.onPress());
  expect(onSelect).toHaveBeenCalledWith("RETAKE");
});

test("marks the selected outcome", async () => {
  await act(async () => {
    renderer = create(<OutcomeFilter sessions={sessions} selected="REFER" onSelect={() => {}} />);
  });
  expect(tabs().map((t) => t.props.accessibilityState.selected)).toEqual([false, true, false]);
});
