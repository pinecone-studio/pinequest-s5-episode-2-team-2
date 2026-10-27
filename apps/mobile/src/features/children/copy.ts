// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
export const childrenCopy = {
  title: "Хүүхдүүд",
  empty: "Хүүхдийн бүртгэл алга",
  add: "Хүүхэд нэмэх",
  edit: "Засах",
  save: "Хадгалах",
  cancel: "Болих",
  delete: "Профайл устгах",
  deleteConfirm: "Энэ профайл болон бүх шалгалтыг нь устгах уу?",
  active: "Сонгосон",
  select: "Сонгох",
  name: "Нэр эсвэл хоч",
  birthYear: "Төрсөн он (заавал биш)",
  age: (years: number) => `Энэ жил ${years} нас хүрнэ`,
  errors: {
    nameRequired: "Нэр эсвэл хоч оруулна уу",
    nameTooLong: "40 тэмдэгтээс хэтрүүлэхгүй",
    birthYear: "Дөрвөн оронтой он оруулна уу, ирээдүйн он биш",
    failed: "Хадгалж чадсангүй. Дахин оролдоно уу.",
  },
} as const;
