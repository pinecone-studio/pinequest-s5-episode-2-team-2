// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
export const childrenCopy = {
  title: "TODO(copy): Children",
  empty: "TODO(copy): No child profiles yet",
  add: "TODO(copy): Add a child",
  edit: "TODO(copy): Edit",
  save: "TODO(copy): Save",
  cancel: "TODO(copy): Cancel",
  delete: "TODO(copy): Delete profile",
  deleteConfirm: "TODO(copy): Delete this profile and all of its scans?",
  active: "TODO(copy): Selected",
  select: "TODO(copy): Select",
  name: "TODO(copy): Name or nickname",
  birthYear: "TODO(copy): Birth year (optional)",
  age: (years: number) => `TODO(copy): ${years} years old this year`,
  errors: {
    nameRequired: "TODO(copy): Enter a name or nickname",
    nameTooLong: "TODO(copy): Use at most 40 characters",
    birthYear: "TODO(copy): Enter a four-digit year, not in the future",
    failed: "TODO(copy): Could not save. Try again.",
  },
} as const;
