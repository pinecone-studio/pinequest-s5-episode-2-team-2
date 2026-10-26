// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
export const eyeViewCopy = {
  title: "TODO(copy): Measured eyes",
  // Back camera: the image-left eye is the child's right eye.
  sides: { imageLeft: "TODO(copy): Right eye", imageRight: "TODO(copy): Left eye" },
  noReflex: "TODO(copy): no light reflex found",
  reflexAt: (x: number, y: number) =>
    `TODO(copy): light reflex ${x.toFixed(2)}, ${y.toFixed(2)} iris radii from the centre`,
  legend: "TODO(copy): Circle: iris. Dot: light reflex. Drawn from the measurement, not a photo.",
} as const;
