import { tipSections } from "./content";

const tips = tipSections.flatMap((section) => section.tips);

test("covers why checks matter, habits and when to see an eye doctor", () => {
  expect(tipSections.map((section) => section.key)).toEqual(["why", "habits", "signs"]);
  for (const section of tipSections) expect(section.tips.length).toBeGreaterThan(0);
});

test("every tip shows a source with a working https link", () => {
  for (const tip of tips) {
    expect(tip.source.label.trim()).not.toBe("");
    expect(tip.source.url).toMatch(/^https:\/\/[^\s]+$/);
  }
});

test("no wording implies a diagnosis, normal eyes or a cure", () => {
  // CONTRIBUTING.md "App copy": stems for diagnose, normal/healthy eyes, cure, fix.
  const banned = [/оношло/i, /хэвийн/i, /эрүүл нүд/i, /эдгэ/i, /засна/i];
  for (const tip of tips) {
    for (const word of banned) expect(tip.text).not.toMatch(word);
  }
});
