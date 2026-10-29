import { act } from "react";
import { create } from "react-test-renderer";
import type { EyePrediction } from "../vision/eyeCrops";
import type { LandmarkFrame } from "../vision/facePipeline";
import { ScanChecks, scanChecks } from "./ScanChecks";

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock("../../components/ui", () => ({ Text: "Text" }));

function eyes(reflex: boolean): [EyePrediction, EyePrediction] {
  return (["imageLeft", "imageRight"] as const).map((side, index): EyePrediction => ({
    side,
    irisCenter: { x: 430 + index * 140, y: 500 },
    irisRadius: 40,
    reflex: reflex ? { x: 431 + index * 140, y: 500 } : null,
    reflexVisibleProbability: reflex ? 1 : 0,
    crop: { side, x: 330 + index * 140, y: 400, size: 200 },
  })) as [EyePrediction, EyePrediction];
}

const frame = (overrides: Partial<LandmarkFrame>): LandmarkFrame => ({
  faceCount: 1,
  landmarks: [],
  frameSize: { width: 3840, height: 2160 },
  timestampMs: 0,
  latencyMs: 0,
  eyes: null,
  ...overrides,
});

test.each<[string, LandmarkFrame | null, boolean[]]>([
  ["no frame yet", null, [false, false, false]],
  ["no face", frame({ faceCount: 0 }), [false, false, false]],
  ["two faces", frame({ faceCount: 2 }), [false, false, false]],
  ["a face without eyes", frame({}), [true, false, false]],
  ["eyes without a reflex", frame({ eyes: eyes(false) }), [true, true, false]],
  ["eyes with both reflexes", frame({ eyes: eyes(true) }), [true, true, true]],
])("%s", (_, input, expected) => {
  expect(scanChecks(input).map((check) => check.ok)).toEqual(expected);
});

test("labels each check with its state for screen readers", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<ScanChecks frame={frame({ eyes: eyes(false) })} />);
  });
  const chips = renderer.root.findAll((node) => node.props.accessibilityRole === "checkbox");
  expect(
    chips.map((chip) => [chip.props.accessibilityLabel, chip.props.accessibilityState]),
  ).toEqual([
    ["Нүүр олдлоо", { checked: true }],
    ["Хоёр нүд олдлоо", { checked: true }],
    ["Тусгал харагдаж байна", { checked: false }],
  ]);
  await act(async () => renderer.unmount());
});
