import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { EmptyState, Loading } from "./EmptyState";

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("./ui", () => ({ Button: "Button", Card: "Card", Text: "Text" }));
jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const render = async (element: React.ReactElement) => {
  await act(async () => {
    renderer = create(element);
  });
};
const find = (type: string) => renderer.root.findAll((node) => node.type === type);
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("shows the icon, the sentence and the next step", async () => {
  const onPress = jest.fn();
  await render(
    <EmptyState icon="time-outline" message="Хоосон" action={{ label: "Эхлэх", onPress }} />,
  );
  expect(find("Ionicons")[0]!.props.name).toBe("time-outline");
  expect(JSON.stringify(renderer.toJSON())).toContain("Хоосон");
  const button = find("Button")[0]!;
  expect(button.props.label).toBe("Эхлэх");
  button.props.onPress();
  expect(onPress).toHaveBeenCalled();
});

test("leaves the button out when there is no next step", async () => {
  await render(<EmptyState icon="eye-outline" message="Хоосон" />);
  expect(find("Button")).toHaveLength(0);
});

test("the spinner carries its label for VoiceOver", async () => {
  await render(<Loading label="Уншиж байна" />);
  const view = find("View")[0]!;
  expect(view.props.accessible).toBe(true);
  expect(view.props.accessibilityLabel).toBe("Уншиж байна");
  expect(find("ActivityIndicator")).toHaveLength(1);
});
