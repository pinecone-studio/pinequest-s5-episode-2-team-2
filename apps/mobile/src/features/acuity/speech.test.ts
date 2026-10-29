import { acceptsSpoken, matchSpoken } from "./speech";

test("the five replies are recognised, with common endings and punctuation", () => {
  expect(matchSpoken("Дээш")).toBe(270);
  expect(matchSpoken("дээшээ.")).toBe(270);
  expect(matchSpoken(" Доошоо!")).toBe(90);
  expect(matchSpoken("зүүн тийшээ")).toBe(180);
  expect(matchSpoken("Баруун.")).toBe(0);
  expect(matchSpoken("Харагдахгүй байна")).toBe("cantSee");
  expect(matchSpoken("мэдэхгүй")).toBe("cantSee");
});

test("one wrong letter in a longer word is forgiven", () => {
  expect(matchSpoken("барун")).toBeNull(); // too short to be sure
  expect(matchSpoken("баруун")).toBe(0);
  expect(matchSpoken("бaруун")).toBe(0); // Latin a mixed in
  expect(matchSpoken("доощ")).toBe(90);
});

test("silence, other words and conflicting words give no answer", () => {
  expect(matchSpoken("")).toBeNull();
  expect(matchSpoken("сайн байна уу")).toBeNull();
  expect(matchSpoken("зүүн үгүй баруун")).toBeNull();
  expect(matchSpoken("дараагийнх")).toBeNull(); // the app's own prompt
});

test("children's spoken left/right is not taken; up, down and can't-see are", () => {
  expect(acceptsSpoken("adult", 180)).toBe(true);
  expect(acceptsSpoken("child4", 180)).toBe(false);
  expect(acceptsSpoken("child4", 0)).toBe(false);
  expect(acceptsSpoken("child3", 270)).toBe(true);
  expect(acceptsSpoken("child5", "cantSee")).toBe(true);
});
