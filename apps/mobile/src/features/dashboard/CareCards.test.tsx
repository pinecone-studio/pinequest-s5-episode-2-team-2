import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { CareCards } from "./CareCards";
import { dashboardCopy as copy } from "./copy";
import { weekSummary } from "../treatment/progress";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock("../../components/ui", () => ({ Text: "Text", Card: "Card" }));
jest.mock("../treatment/WeekBars", () => ({ WeekBars: "WeekBars" }));
jest.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  StyleSheet: { create: (s: unknown) => s },
}));
const empty = () => ({ goal: null, hasLogs: false, week: weekSummary([], null, new Date()) });
const details = () => ({
  childId: "child-b",
  patch: empty(),
  glasses: empty(),
  habits: { outdoor: 0, screen_break: 0 },
});
let renderer: ReactTestRenderer;
async function render(data: ReturnType<typeof details>) {
  await act(async () => {
    renderer = create(<CareCards details={data} />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockPush.mockClear();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("empty treatment and habits still link to this child's detail screens", async () => {
  await render(details());
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain(copy.noTreatment);
  expect(text).toContain(copy.noHabits);
  renderer.root
    .findByProps({ accessibilityLabel: `${copy.treatment}: ${copy.open}` })
    .props.onPress();
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: "/treatment",
    params: { childId: "child-b" },
  });
  renderer.root.findByProps({ accessibilityLabel: `${copy.habits}: ${copy.open}` }).props.onPress();
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: "/habits",
    params: { childId: "child-b" },
  });
});

test("reuses seven-day bars without creating a goal and shows recorded habit totals", async () => {
  const data = details();
  data.patch.hasLogs = true;
  data.habits = { outdoor: 45, screen_break: 3 };
  await render(data);
  const bars = renderer.root.findByType("WeekBars" as never);
  expect(bars.props.week).toEqual(data.patch.week);
  expect(bars.props.goal).toBeNull();
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain(copy.noGoal);
  expect(text).toContain(copy.outdoor(45));
  expect(text).toContain(copy.breaks(3));
  expect(text).not.toContain(copy.noHabits);
});
