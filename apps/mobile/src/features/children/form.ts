import type { ChildDetails } from "../../storage/children";

export const MAX_NAME_LENGTH = 40;
/** Oldest birth year the form accepts; the app is for children. */
export const MIN_BIRTH_YEAR = 1990;

export type ChildFormError = "nameRequired" | "nameTooLong" | "birthYear";
export type ChildFormResult =
  { ok: true; details: ChildDetails } | { ok: false; errors: ChildFormError[] };

/** Validates the profile form fields; an empty birth year means "not given". */
export function parseChildForm(
  input: { name: string; birthYear: string },
  now: Date = new Date(),
): ChildFormResult {
  const errors: ChildFormError[] = [];
  const name = input.name.trim();
  if (!name) errors.push("nameRequired");
  else if ([...name].length > MAX_NAME_LENGTH) errors.push("nameTooLong");

  const yearText = input.birthYear.trim();
  let birthYear: number | null = null;
  if (yearText) {
    birthYear = /^\d{4}$/.test(yearText) ? Number(yearText) : NaN;
    if (!(birthYear >= MIN_BIRTH_YEAR && birthYear <= now.getFullYear())) errors.push("birthYear");
  }
  return errors.length ? { ok: false, errors } : { ok: true, details: { name, birthYear } };
}

/** Form fields for editing an existing profile. */
export function childFormFields(child: { name: string; birthYear: number | null }) {
  return { name: child.name, birthYear: child.birthYear === null ? "" : String(child.birthYear) };
}

/** Locally unique ID without a native module: time plus randomness. */
export function newChildId(now: number = Date.now(), random: () => number = Math.random): string {
  return `child-${now.toString(36)}-${Math.floor(random() * 36 ** 8).toString(36)}`;
}
