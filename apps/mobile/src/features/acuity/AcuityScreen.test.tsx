import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import AcuityScreen from "./AcuityScreen";
import { acuityCopy as copy } from "./copy";
import { Optotype } from "./Optotype";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ router: { back: () => mockBack() } }));
jest.mock("./SaveAcuityButton", () => ({ SaveAcuityButton: "SaveAcuityButton" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
  Verdict: "Verdict",
  Notice: "Notice",
}));
jest.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  PixelRatio: { get: () => 3 },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const all = (type: string) => renderer.root.findAll((n) => n.type === type);
// Buttons by label; the age-group choices are Pressables with an accessibility label.
const press = (label: string) =>
  act(() =>
    renderer.root
      .find(
        (n) =>
          (n.type === ("Button" as never) && n.props.label === label) ||
          (n.type === ("Pressable" as never) && n.props.accessibilityLabel === label),
      )
      .props.onPress(),
  );
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(() => act(() => renderer?.unmount()));

test("the E has four strokes, plus four bars when crowded, and turns with direction", () => {
  act(() => {
    renderer = create(<Optotype size={50} direction={90} crowded={false} />);
  });
  const box = renderer.root.findAll((n) => (n.type as unknown) === "View")[0]!;
  expect(box.props.style).toMatchObject({
    width: 50,
    height: 50,
    transform: [{ rotate: "90deg" }],
  });
  expect(all("View")).toHaveLength(1 + 4);
  act(() => renderer.update(<Optotype size={50} direction={0} crowded />));
  expect(all("View")).toHaveLength(1 + 8);
  // Crowded box is 12 strokes wide: 120 points for a 50-point letter.
  expect(all("View")[0]!.props.style.width).toBe(120);
});

test("runs both eyes from age group to result", () => {
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  // Four age-group choices.
  expect(all("Pressable")).toHaveLength(4);
  press(copy.groups.adult);
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.cover("right"));
  press(copy.ready);
  // Four arrows and "can't see"; two misses finish the right eye.
  expect(all("Pressable")).toHaveLength(4);
  press(copy.cantSee);
  press(copy.cantSee);
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.cover("left"));
  press(copy.ready);
  press(copy.cantSee);
  press(copy.cantSee);
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain(copy.belowChart);
  expect(text).toContain(copy.refer);
  expect(text).toContain(copy.notice);
  expect(all("SaveAcuityButton")[0]!.props.check).toEqual({
    group: "adult",
    right: null,
    left: null,
    refer: true,
  });
  press(copy.done);
  expect(mockBack).toHaveBeenCalled();
});
