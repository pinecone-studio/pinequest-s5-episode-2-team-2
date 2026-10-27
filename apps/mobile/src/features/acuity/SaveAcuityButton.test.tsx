import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { acuityCopy as copy } from "./copy";
import { SaveAcuityButton } from "./SaveAcuityButton";

const mockSave = jest.fn();
let mockChildId: string | null = "c1";
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => "db" }));
jest.mock("../children/useActiveChildId", () => ({ useActiveChildId: () => mockChildId }));
jest.mock("../../storage/acuity", () => ({
  acuityResultId: () => "acuity-1",
  saveAcuityResult: (...args: unknown[]) => mockSave(...args),
}));
jest.mock("../../components/ui", () => ({ Button: "Button", Text: "Text" }));

const check = { group: "child4" as const, right: 0.3, left: null, refer: true };
let renderer: ReactTestRenderer;
const button = () => renderer.root.findAll((n) => n.type === ("Button" as never))[0]!;
const text = () => JSON.stringify(renderer.toJSON());
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockSave.mockReset().mockResolvedValue(undefined);
  mockChildId = "c1";
});
afterEach(() => act(() => renderer?.unmount()));

test("saves the check once for the selected child", async () => {
  act(() => {
    renderer = create(<SaveAcuityButton check={check} />);
  });
  await act(async () => button().props.onPress());
  expect(mockSave).toHaveBeenCalledWith(
    "db",
    expect.objectContaining({ ...check, id: "acuity-1", childId: "c1" }),
  );
  expect(text()).toContain(copy.saved);
  expect(button().props.disabled).toBe(true);
  await act(async () => button().props.onPress());
  expect(mockSave).toHaveBeenCalledTimes(1);
});

test("needs a child profile and reports failures", async () => {
  mockChildId = null;
  act(() => {
    renderer = create(<SaveAcuityButton check={check} />);
  });
  expect(button().props.disabled).toBe(true);
  expect(text()).toContain(copy.noChild);

  mockChildId = "c1";
  mockSave.mockRejectedValue(new Error("disk full"));
  act(() => renderer.update(<SaveAcuityButton check={{ ...check }} />));
  await act(async () => button().props.onPress());
  expect(text()).toContain(copy.failed);
});
