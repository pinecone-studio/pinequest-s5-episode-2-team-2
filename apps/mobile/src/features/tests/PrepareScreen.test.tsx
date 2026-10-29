import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import PrepareScreen from "./PrepareScreen";
import { testsCopy } from "./copy";

const copy = testsCopy.prepare;
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));
jest.mock("./pictures", () => ({ StepPicture: "StepPicture" }));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
}));
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  act(() => {
    renderer = create(<PrepareScreen />);
  });
});
afterEach(() => act(() => renderer.unmount()));

test("shows the three steps in order, each with a picture", () => {
  const json = JSON.stringify(renderer.toJSON());
  const steps = Object.values(copy.steps);
  expect(steps).toHaveLength(3);
  const positions = steps.map((step) => json.indexOf(step));
  expect(positions.every((p) => p >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  expect(renderer.root.findAll((n) => n.type === ("StepPicture" as never))).toHaveLength(3);
});

test("opens the camera in place of the steps", () => {
  const button = renderer.root.findByType("Button" as never);
  expect(button.props.label).toBe(copy.continue);
  act(() => button.props.onPress());
  expect(mockReplace).toHaveBeenCalledWith("/scan");
});
