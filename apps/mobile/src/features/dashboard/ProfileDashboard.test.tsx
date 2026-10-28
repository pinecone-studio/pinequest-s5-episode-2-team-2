import { act } from "react";
import type * as React from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { ProfileDashboard } from "./ProfileDashboard";
import { dashboardCopy as copy } from "./copy";
import { childrenCopy } from "../children/copy";
import { loadDashboard, type Dashboard } from "./data";

jest.mock("./data", () => ({ loadDashboard: jest.fn() }));
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => "db" }));
let mockFocus!: () => void;
const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof React>("react");
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
    useFocusEffect: (effect: () => void) => {
      mockFocus = effect;
      useEffect(effect, [effect]);
    },
  };
});
jest.mock("../children/ChildrenList", () => ({ ChildrenList: "ChildrenList" }));
jest.mock("../../components/EmptyState", () => ({ EmptyState: "EmptyState", Loading: "Loading" }));
jest.mock("../../components/ui", () => ({ Button: "Button", Card: "Card", Text: "Text" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (s: unknown) => s },
}));
let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const snapshot = (name: string, birthYear: number | null = null): Dashboard => ({
  children: [],
  child: { id: name, name, birthYear, createdAt: "" },
  details: {
    childId: name,
    asOf: new Date(),
    sessions: [],
    latestScan: null,
    latestVision: null,
    patch: { goal: null, hasLogs: false, week: [] },
    glasses: { goal: null, hasLogs: false, week: [] },
    habits: { outdoor: 0, screen_break: 0 },
  },
});
async function render() {
  await act(async () => {
    renderer = create(<ProfileDashboard />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("shows the child's name and available age, and reuses the profile selector", async () => {
  jest.mocked(loadDashboard).mockResolvedValue(snapshot("Номин", 2020));
  await render();
  expect(text()).toContain(copy.age(new Date().getFullYear() - 2020));
  await act(async () =>
    renderer.root.findByProps({ accessibilityLabel: copy.switchChild }).props.onPress(),
  );
  expect(renderer.root.findAllByType("ChildrenList" as never)).toHaveLength(1);
});

test("selection hides the old snapshot and reloads all child data", async () => {
  jest.mocked(loadDashboard).mockResolvedValueOnce(snapshot("Номин"));
  await render();
  await act(async () =>
    renderer.root.findByProps({ accessibilityLabel: copy.switchChild }).props.onPress(),
  );
  let finish!: (value: Dashboard) => void;
  jest.mocked(loadDashboard).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => renderer.root.findByType("ChildrenList" as never).props.onSelect());
  expect(text()).not.toContain("Номин");
  expect(text()).toContain(copy.loading);
  await act(async () => finish(snapshot("Саруул")));
  expect(text()).toContain("Саруул");
  expect(text()).not.toContain(copy.age(0));
});

test("without profiles, one empty state leads to adding a child (#237)", async () => {
  jest.mocked(loadDashboard).mockResolvedValue({ children: [], child: null, details: null });
  await render();
  const empty = renderer.root.findByType("EmptyState" as never);
  expect(empty.props.message).toBe(copy.noChild);
  expect(empty.props.action.label).toBe(childrenCopy.add);
  await act(async () => empty.props.action.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/child/[id]", params: { id: "new" } });
  expect(renderer.root.findAllByType("ChildrenList" as never)).toHaveLength(0);
});

test("failed reads show a retry and can recover", async () => {
  jest.mocked(loadDashboard).mockRejectedValueOnce(new Error("db"));
  await render();
  expect(text()).toContain(copy.failed);
  jest.mocked(loadDashboard).mockResolvedValueOnce(snapshot("Номин"));
  await act(async () => renderer.root.findByProps({ label: copy.retry }).props.onPress());
  expect(text()).toContain("Номин");
});

test("a slower earlier focus read cannot replace a newer child snapshot", async () => {
  let first!: (value: Dashboard) => void;
  let second!: (value: Dashboard) => void;
  jest
    .mocked(loadDashboard)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          second = resolve;
        }),
    );
  await render();
  await act(async () => mockFocus());
  await act(async () => second(snapshot("Саруул")));
  await act(async () => first(snapshot("Номин")));
  expect(text()).toContain("Саруул");
  expect(text()).not.toContain("Номин");
});
