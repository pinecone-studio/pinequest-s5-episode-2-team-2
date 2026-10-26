import { childFormFields, MAX_NAME_LENGTH, newChildId, parseChildForm } from "./form";

const now = new Date("2026-10-26T03:00:00Z");

test("accepts a trimmed name with or without a birth year", () => {
  expect(parseChildForm({ name: "  Номин ", birthYear: "" }, now)).toEqual({
    ok: true,
    details: { name: "Номин", birthYear: null },
  });
  expect(parseChildForm({ name: "Номин", birthYear: " 2020 " }, now)).toEqual({
    ok: true,
    details: { name: "Номин", birthYear: 2020 },
  });
});

test("requires a name of limited length, counting characters not bytes", () => {
  expect(parseChildForm({ name: "   ", birthYear: "" }, now)).toEqual({
    ok: false,
    errors: ["nameRequired"],
  });
  expect(parseChildForm({ name: "Ө".repeat(MAX_NAME_LENGTH), birthYear: "" }, now).ok).toBe(true);
  expect(parseChildForm({ name: "Ө".repeat(MAX_NAME_LENGTH + 1), birthYear: "" }, now)).toEqual({
    ok: false,
    errors: ["nameTooLong"],
  });
});

test.each(["20", "20201", "2027", "1989", "two", "2020.5"])("rejects birth year %s", (year) => {
  expect(parseChildForm({ name: "Номин", birthYear: year }, now)).toEqual({
    ok: false,
    errors: ["birthYear"],
  });
});

test("reports every invalid field at once", () => {
  expect(parseChildForm({ name: "", birthYear: "abc" }, now)).toEqual({
    ok: false,
    errors: ["nameRequired", "birthYear"],
  });
});

test("fills the form from a saved profile", () => {
  expect(childFormFields({ name: "Номин", birthYear: 2020 })).toEqual({
    name: "Номин",
    birthYear: "2020",
  });
  expect(childFormFields({ name: "Номин", birthYear: null }).birthYear).toBe("");
});

test("creates distinct readable IDs", () => {
  expect(newChildId(0, () => 0)).toBe("child-0-0");
  expect(newChildId(1, () => 0.5)).not.toBe(newChildId(1, () => 0.25));
});
