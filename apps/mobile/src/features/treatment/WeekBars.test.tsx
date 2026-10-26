import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { treatmentCopy as copy } from "./copy";
import type { DaySummary } from "./progress";
import { WeekBars } from "./WeekBars";

jest.mock("../../components/ui", () => ({ Text: "Text" }));
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

const week = (minutes: number[], goal: number | null): DaySummary[] =>
  minutes.map((m, i) => ({
    day: new Date(2026, 9, 20 + i),
    minutes: m,
    metGoal: goal === null ? null : m >= goal,
  }));

let renderer: ReactTestRenderer;
const labels = () =>
  renderer.root
    .findAll((n) => typeof n.props.accessibilityLabel === "string")
    .map((n) => n.props.accessibilityLabel as string);
const text = () => JSON.stringify(renderer.toJSON());
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("labels every day with its minutes and goal status and shows the streak", async () => {
  const days = week([0, 30, 60, 90, 120, 60, 10], 60);
  await act(async () => {
    renderer = create(<WeekBars week={days} goal={60} />);
  });
  expect(labels()).toHaveLength(7);
  expect(labels()[0]).toBe(copy.dayLabel(days[0]!.day, 0, false));
  expect(labels()[4]).toBe(copy.dayLabel(days[4]!.day, 120, true));
  // Today (10 min) is unfinished, so the streak counts the four days before it.
  expect(text()).toContain(copy.streak(4));
});

test("hides the goal line and streak without a goal", async () => {
  await act(async () => {
    renderer = create(<WeekBars week={week([0, 0, 0], null)} goal={null} />);
  });
  expect(labels()[0]).toBe(copy.dayLabel(new Date(2026, 9, 20), 0, null));
  expect(text()).not.toContain(copy.streak(0));
});
