// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
export const childrenCopy = {
  title: "TODO(copy): Хүүхдүүд",
  empty: "TODO(copy): Хүүхдийн бүртгэл алга",
  add: "TODO(copy): Хүүхэд нэмэх",
  edit: "TODO(copy): Засах",
  save: "TODO(copy): Save",
  cancel: "TODO(copy): Cancel",
  delete: "TODO(copy): Delete profile",
  deleteConfirm: "TODO(copy): Delete this profile and all of its scans?",
  active: "TODO(copy): Сонгосон",
  select: "TODO(copy): Select",
  name: "TODO(copy): Name or nickname",
  birthYear: "TODO(copy): Birth year (optional)",
  age: (years: number) => `TODO(copy): Энэ жил ${years} нас хүрнэ`,
  errors: {
    nameRequired: "TODO(copy): Enter a name or nickname",
    nameTooLong: "TODO(copy): Use at most 40 characters",
    birthYear: "TODO(copy): Enter a four-digit year, not in the future",
    failed: "TODO(copy): Хадгалж чадсангүй. Дахин оролдоно уу.",
  },
} as const;
