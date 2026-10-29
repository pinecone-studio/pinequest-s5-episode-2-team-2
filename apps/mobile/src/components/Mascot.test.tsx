import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { Mascot } from "./Mascot";

const mockStart = jest.fn();
let mockReduceMotion = false;
const mockValue = () => ({
  setValue: jest.fn(),
  interpolate: ({ outputRange }: { outputRange: number[] }) => outputRange[1],
});
jest.mock("./mascots", () => ({ mascotSources: { wave: 1, celebrate: 2 } }));
jest.mock("react-native", () => {
  const animation = () => ({
    start: (done?: () => void) => (mockStart(), done?.()),
    stop: jest.fn(),
  });
  return {
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => mockReduceMotion,
      addEventListener: () => ({ remove: jest.fn() }),
    },
    Animated: {
      Value: jest.fn(() => mockValue()),
      Image: "AnimatedImage",
      loop: animation,
      sequence: animation,
      timing: animation,
      spring: animation,
    },
    Easing: { inOut: () => undefined, sin: undefined },
    StyleSheet: { create: (styles: unknown) => styles },
    View: "View",
    Image: "Image",
    useWindowDimensions: () => ({ width: 300, height: 700 }),
  };
});

let renderer: ReactTestRenderer;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockStart.mockClear();
  mockReduceMotion = false;
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = create(element);
  });
}
const image = () =>
  renderer.root.find((node) => ["AnimatedImage", "Image"].includes(String(node.type)));

test("draws the chosen pose and shrinks to fit a narrow screen", async () => {
  await render(<Mascot variant="wave" size={240} />);
  expect(image().props.source).toBe(1);
  // 60% of a 300-point screen is 180, smaller than the 240 asked for.
  const wrap = renderer.root.findAll((node) => String(node.type) === "View")[0]!;
  expect(wrap.props.style[1]).toEqual({ width: 180, height: 180 });
});

test("is decorative by default and readable when asked", async () => {
  await render(<Mascot variant="wave" />);
  let wrap = renderer.root.findAll((node) => String(node.type) === "View")[0]!;
  expect(wrap.props.accessibilityElementsHidden).toBe(true);
  await act(async () => renderer.update(<Mascot variant="wave" decorative={false} />));
  wrap = renderer.root.findAll((node) => String(node.type) === "View")[0]!;
  expect(wrap.props.accessibilityLabel).toBeTruthy();
});

test("still mascots never animate", async () => {
  await render(<Mascot variant="wave" />);
  expect(mockStart).not.toHaveBeenCalled();
});

test("motion runs only when Reduce Motion is off", async () => {
  await render(<Mascot variant="celebrate" motion="pop" />);
  expect(mockStart).toHaveBeenCalled();
  await act(async () => renderer.unmount());
  mockStart.mockClear();
  mockReduceMotion = true;
  await render(<Mascot variant="celebrate" motion="pop" />);
  expect(mockStart).not.toHaveBeenCalled();
});
