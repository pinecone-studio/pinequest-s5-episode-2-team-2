import { act } from "react";
import type * as React from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { useActiveChildId } from "./useActiveChildId";

const mockDb = {};
let mockParams: { childId?: string };
const mockGet = jest.fn<Promise<string | null>, [unknown]>();
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof React>("react");
  return {
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock("../../storage/activeChild", () => ({
  getActiveChildId: (db: unknown) => mockGet(db),
}));

let renderer: ReactTestRenderer;
let value: string | null | undefined;
function Probe() {
  value = useActiveChildId();
  return null;
}
async function render() {
  await act(async () => {
    renderer = create(<Probe />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
  mockParams = {};
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("uses the route param without reading storage", async () => {
  mockParams = { childId: "from-route" };
  await render();
  expect(value).toBe("from-route");
  expect(mockGet).not.toHaveBeenCalled();
});

test("reads the stored selection", async () => {
  mockGet.mockResolvedValue("selected");
  await render();
  expect(mockGet).toHaveBeenCalledWith(mockDb);
  expect(value).toBe("selected");
});

test("is null without profiles or when storage fails", async () => {
  mockGet.mockResolvedValueOnce(null);
  await render();
  expect(value).toBeNull();
  await act(async () => renderer.unmount());
  mockGet.mockRejectedValueOnce(new Error("db"));
  await render();
  expect(value).toBeNull();
});
