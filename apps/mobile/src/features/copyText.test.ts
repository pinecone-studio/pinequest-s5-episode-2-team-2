import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Modules the screens take their text from; a TODO left in a string ends up on screen (#163).
const COPY_FILES = ["copy.ts", "content.ts", "resultCopy.ts"];
const files = readdirSync(__dirname, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => COPY_FILES.map((name) => join(__dirname, entry.name, name)))
  .filter((file) => existsSync(file));

/** Every string a module exports; functions are checked by their source text. */
function texts(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [value.toString()];
  if (value === null || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  return Object.values(value).flatMap((child) => texts(child, seen));
}

test("finds the copy modules", () => {
  expect(files.length).toBeGreaterThan(10);
});

test.each(files.map((file) => [relative(__dirname, file), file]))(
  "%s shows no TODO text to users",
  (_name, file) => {
    for (const text of texts(jest.requireActual(file))) expect(text).not.toContain("TODO");
  },
);
