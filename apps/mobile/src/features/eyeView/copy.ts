// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
export const eyeViewCopy = {
  title: "Хэмжсэн нүд",
  // Back camera: the image-left eye is the child's right eye.
  sides: { imageLeft: "Баруун нүд", imageRight: "Зүүн нүд" },
  noReflex: "гэрлийн тусгал олдсонгүй",
  reflexAt: (x: number, y: number) =>
    `гэрлийн тусгал төвөөс ${x.toFixed(2)}, ${y.toFixed(2)} радиус зайтай`,
  legend: "Тойрог: солонгон бүрхэвч. Цэг: гэрлийн тусгал. Зураг биш, хэмжилтээр зурсан.",
  // The photo legend and note are the web demo's strings (demo/web-poc).
  photo: { iris: "Солонгон бүрхүүл", reflex: "Гэрлийн тусгал", notSaved: "Зураг хадгалагдаагүй." },
} as const;
