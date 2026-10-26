import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import ChildFormScreen from "./ChildFormScreen";
import { childrenCopy as copy } from "./copy";

const mockDb = {};
let mockId: string;
const mockBack = jest.fn();
const mockAlert = jest.fn();
const mockStorage = {
  createChild: jest.fn(),
  updateChild: jest.fn(),
  deleteChild: jest.fn(),
  getChild: jest.fn(),
  setActiveChildId: jest.fn(),
};
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("expo-router", () => ({
  router: { back: () => mockBack() },
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock("../../storage/children", () => ({
  createChild: (...a: unknown[]) => mockStorage.createChild(...a),
  updateChild: (...a: unknown[]) => mockStorage.updateChild(...a),
  deleteChild: (...a: unknown[]) => mockStorage.deleteChild(...a),
  getChild: (...a: unknown[]) => mockStorage.getChild(...a),
}));
jest.mock("../../storage/activeChild", () => ({
  setActiveChildId: (...a: unknown[]) => mockStorage.setActiveChildId(...a),
}));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
}));
jest.mock("react-native", () => ({
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
  TextInput: "TextInput",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const nodes = (type: string) => renderer.root.findAll((node) => node.type === type);
const button = (label: string) => nodes("Button").find((node) => node.props.label === label);
const type = (index: number, value: string) =>
  act(async () => nodes("TextInput")[index]!.props.onChangeText(value));
const press = (label: string) => act(async () => button(label)!.props.onPress());
async function render(id: string) {
  mockId = id;
  await act(async () => {
    renderer = create(<ChildFormScreen />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("creates a profile, selects it and goes back", async () => {
  mockStorage.createChild.mockImplementation(async (_db, id: string, details) => ({
    id,
    ...details,
  }));
  await render("new");
  expect(button(copy.delete)).toBeUndefined();
  await type(0, " Номин ");
  await type(1, "2020");
  await press(copy.save);
  const [, id, details] = mockStorage.createChild.mock.calls[0]!;
  expect(details).toEqual({ name: "Номин", birthYear: 2020 });
  expect(mockStorage.setActiveChildId).toHaveBeenCalledWith(mockDb, id);
  expect(mockBack).toHaveBeenCalled();
});

test("shows validation errors without saving", async () => {
  await render("new");
  await type(1, "20");
  await press(copy.save);
  expect(text()).toContain(copy.errors.nameRequired);
  expect(text()).toContain(copy.errors.birthYear);
  expect(mockStorage.createChild).not.toHaveBeenCalled();
});

test("edits an existing profile", async () => {
  mockStorage.getChild.mockResolvedValue({ id: "c1", name: "Номин", birthYear: null });
  mockStorage.updateChild.mockResolvedValue({});
  await render("c1");
  expect(nodes("TextInput")[0]!.props.value).toBe("Номин");
  await type(0, "Нараа");
  await press(copy.save);
  expect(mockStorage.updateChild).toHaveBeenCalledWith(mockDb, "c1", {
    name: "Нараа",
    birthYear: null,
  });
  expect(mockBack).toHaveBeenCalled();
});

test("keeps the form open when saving fails", async () => {
  mockStorage.createChild.mockRejectedValue(new Error("db"));
  await render("new");
  await type(0, "Номин");
  await press(copy.save);
  expect(text()).toContain(copy.errors.failed);
  expect(mockBack).not.toHaveBeenCalled();
});

test("deletes a profile only after confirmation", async () => {
  mockStorage.getChild.mockResolvedValue({ id: "c1", name: "Номин", birthYear: 2020 });
  mockStorage.deleteChild.mockResolvedValue(undefined);
  await render("c1");
  await press(copy.delete);
  expect(mockStorage.deleteChild).not.toHaveBeenCalled();
  const actions = mockAlert.mock.calls[0]![2] as { style: string; onPress?: () => void }[];
  await act(async () => actions.find((a) => a.style === "destructive")!.onPress!());
  expect(mockStorage.deleteChild).toHaveBeenCalledWith(mockDb, "c1");
  expect(mockBack).toHaveBeenCalled();
});
