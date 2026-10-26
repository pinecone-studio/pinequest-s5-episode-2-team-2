import { act } from "react";
import type * as React from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { ChildrenList } from "./ChildrenList";
import { childrenCopy as copy } from "./copy";

const mockDb = {};
const mockPush = jest.fn();
const mockList = jest.fn();
const mockGetActive = jest.fn();
const mockSetActive = jest.fn();
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof React>("react");
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock("../../storage/children", () => ({ listChildren: (db: unknown) => mockList(db) }));
jest.mock("../../storage/activeChild", () => ({
  getActiveChildId: (db: unknown) => mockGetActive(db),
  setActiveChildId: (...args: unknown[]) => mockSetActive(...args),
}));
jest.mock("../../components/ui", () => ({ Button: "Button", Card: "Card", Text: "Text" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const nodes = (type: string) => renderer.root.findAll((node) => node.type === type);
const radios = () => nodes("Pressable").filter((n) => n.props.accessibilityRole === "radio");
async function render() {
  await act(async () => {
    renderer = create(<ChildrenList />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
  mockList.mockResolvedValue([
    { id: "a", name: "Номин", birthYear: 2020, createdAt: "" },
    { id: "b", name: "Тэмүүлэн", birthYear: null, createdAt: "" },
  ]);
  mockGetActive.mockResolvedValue("a");
  mockSetActive.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("shows the empty state and the add button", async () => {
  mockList.mockResolvedValue([]);
  mockGetActive.mockResolvedValue(null);
  await render();
  expect(text()).toContain(copy.empty);
  await act(async () => nodes("Button")[0]!.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/child/[id]", params: { id: "new" } });
});

test("marks the selected child and selects another", async () => {
  await render();
  expect(radios().map((r) => r.props.accessibilityState.checked)).toEqual([true, false]);
  await act(async () => radios()[1]!.props.onPress());
  expect(mockSetActive).toHaveBeenCalledWith(mockDb, "b");
  expect(radios().map((r) => r.props.accessibilityState.checked)).toEqual([false, true]);
});

test("shows the selection and the age this year", async () => {
  await render();
  const age = new Date().getFullYear() - 2020;
  expect(text()).toContain(`${copy.active} · ${copy.age(age)}`);
});

test("opens a profile for editing", async () => {
  await render();
  const edit = nodes("Pressable").find(
    (n) => n.props.accessibilityLabel === `${copy.edit}: Тэмүүлэн`,
  );
  await act(async () => edit!.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/child/[id]", params: { id: "b" } });
});
