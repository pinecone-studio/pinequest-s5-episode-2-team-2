import { act, type ReactElement } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { CheckPicture, StepPicture } from "./pictures";

jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("../../components/ui", () => ({ Text: "Text" }));
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer | undefined;
function render(element: ReactElement) {
  act(() => {
    renderer?.unmount();
    renderer = create(element);
  });
}
const icons = () =>
  renderer!.root.findAll((n) => n.type === ("Ionicons" as never)).map((n) => n.props.name);
const json = () => JSON.stringify(renderer!.toJSON());
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

test("the scan picture shows the phone's light, the distance and the child", () => {
  render(<CheckPicture id="strabismus" distance="35 см орчим" />);
  expect(icons()).toEqual(["flashlight", "happy"]);
  expect(json()).toContain("35 см орчим");
});

test("the vision picture shows the letter E on the phone", () => {
  render(<CheckPicture id="vision" distance="3 метр орчим" />);
  expect(icons()).toEqual(["happy"]);
  expect(json()).toContain('"E"');
});

test("pictures are hidden from VoiceOver, because the text says the same", () => {
  render(<CheckPicture id="vision" distance="3 метр орчим" />);
  expect(renderer!.root.findByType("LinearGradient" as never).props).toMatchObject({
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants",
  });
  render(<StepPicture from="eye-outline" to="camera-outline" />);
  expect(renderer!.root.findAllByType("View" as never)[0]!.props.accessibilityElementsHidden).toBe(
    true,
  );
});

test("a step links its two icons with an arrow, or with a distance when given", () => {
  render(<StepPicture from="eye-outline" to="camera-outline" />);
  expect(icons()).toEqual(["eye-outline", "arrow-forward", "camera-outline"]);
  render(<StepPicture from="phone-portrait-outline" to="happy-outline" label="35 см" />);
  expect(icons()).toEqual(["phone-portrait-outline", "happy-outline"]);
  expect(json()).toContain("35 см");
});
