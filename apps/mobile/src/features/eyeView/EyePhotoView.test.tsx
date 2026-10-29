import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockEyeMeasure } from "@app/core";
import type { EyeMeasure } from "@app/core";
import { EyePhotoView, photoPoint } from "./EyePhotoView";
import type { ResultPhotos } from "./EyePhotoView";

jest.mock("react-native", () => ({
  View: "View",
  Image: "Image",
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock("../../components/ui", () => ({ Text: "Text" }));

const crop = { x: 100, y: 200, size: 256 };
const eye = (side: EyeMeasure["side"], reflex: boolean): EyeMeasure => ({
  ...mockEyeMeasure(side),
  irisCenter: { x: 228, y: 328 },
  irisRadius: 51.2,
  reflex: reflex ? { x: 238.24, y: 328 } : null,
  reflexOffset: reflex ? { x: 0.2, y: 0 } : null,
});
const photos: ResultPhotos = [
  { crop, pixels: new Uint8Array(128 * 128 * 3).fill(90) },
  { crop, pixels: new Uint8Array(128 * 128 * 3).fill(120) },
];

let renderer: ReactTestRenderer;
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("maps frame points into the photo box", () => {
  expect(photoPoint({ x: 228, y: 328 }, crop, 140)).toEqual({ x: 70, y: 70 });
  expect(photoPoint({ x: 100, y: 456 }, crop, 140)).toEqual({ x: 0, y: 140 });
});

test("shows each eye's photo with its iris circle and reflex where they were measured", async () => {
  await act(async () => {
    renderer = create(
      <EyePhotoView eyes={[eye("imageLeft", true), eye("imageRight", false)]} photos={photos} />,
    );
  });
  const images = renderer.root.findAllByType("Image" as never);
  expect(images).toHaveLength(2);
  for (const image of images) {
    expect(image.props.source.uri).toMatch(/^data:image\/png;base64,/);
  }
  expect(images[0]!.props.source.uri).not.toBe(images[1]!.props.source.uri);

  const irises = renderer.root.findAll((n) => n.props.testID === "photo-iris");
  // Radius 51.2 of a 256 px crop in a 140 px box is 28; centre (70, 70).
  expect(irises[0]!.props.style[1]).toEqual({
    left: 42,
    top: 42,
    width: 56,
    height: 56,
    borderRadius: 28,
  });
  const reflexes = renderer.root.findAll((n) => n.props.testID === "photo-reflex");
  expect(reflexes).toHaveLength(1);
  expect(reflexes[0]!.props.style[1].left).toBeCloseTo((138.24 / 256) * 140 - 6);

  const labels = renderer.root
    .findAll((n) => typeof n.props.accessibilityLabel === "string")
    .map((n) => n.props.accessibilityLabel);
  expect(labels).toEqual([
    "Баруун нүд: гэрлийн тусгал төвөөс 0.20, 0.00 радиус зайтай",
    "Зүүн нүд: гэрлийн тусгал олдсонгүй",
  ]);
});
