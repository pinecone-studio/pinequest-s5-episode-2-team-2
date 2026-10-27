import { ageThisYear, childFormFields, MAX_NAME_LENGTH, newChildId, parseChildForm } from "./form";

// Properties of the profile form over many inputs.

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const NOW = new Date("2026-10-27T03:00:00Z");
const LETTERS = "абвгдеёжзийклмноөпрсөтуүфхцчшщъыьэюяABCabc ";
const random = lcg(5);
const names = Array.from({ length: 300 }, () =>
  Array.from(
    { length: 1 + Math.floor(random() * 50) },
    () => LETTERS[Math.floor(random() * LETTERS.length)],
  ).join(""),
);

test("a saved profile fills the form so that saving it again changes nothing", () => {
  for (const name of names) {
    const year = random() < 0.3 ? "" : String(2010 + Math.floor(random() * 17));
    const first = parseChildForm({ name, birthYear: year }, NOW);
    if (!first.ok) continue;
    const details = { name: first.details.name, birthYear: first.details.birthYear ?? null };
    const again = parseChildForm(childFormFields(details), NOW);
    expect(again).toEqual(first);
  }
});

test("accepted names are trimmed, non-empty and within the length limit", () => {
  for (const name of names) {
    const result = parseChildForm({ name, birthYear: "" }, NOW);
    const trimmed = name.trim();
    expect(result.ok).toBe(trimmed.length > 0 && [...trimmed].length <= MAX_NAME_LENGTH);
    if (result.ok) expect(result.details.name).toBe(trimmed);
  }
});

test("the age this year matches the accepted birth year", () => {
  for (let year = 1990; year <= 2026; year++) {
    const result = parseChildForm({ name: "Номин", birthYear: String(year) }, NOW);
    expect(result.ok).toBe(true);
    expect(ageThisYear(year, NOW)).toBe(2026 - year);
  }
});

test("ids made at the same moment differ when the random part differs", () => {
  const ids = new Set(Array.from({ length: 500 }, () => newChildId(1_000, random)));
  expect(ids.size).toBeGreaterThan(495);
  for (const id of ids) expect(id).toMatch(/^child-[0-9a-z]+-[0-9a-z]+$/);
});
