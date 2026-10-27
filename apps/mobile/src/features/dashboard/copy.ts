// TODO(copy): Mongolian draft wording for team review; no diagnostic claims.
export const dashboardCopy = {
  open: "TODO(copy): Дэлгэрэнгүй",
  scan: "TODO(copy): Сүүлийн нүдний шалгалт",
  noScan: "TODO(copy): Хадгалсан нүдний шалгалт алга",
  progress: "TODO(copy): Хэмжилтийн явц",
  title: "TODO(copy): Хүүхдийн хяналт",
  switchChild: "TODO(copy): Хүүхэд солих",
  manage: "TODO(copy): Хүүхдийн мэдээлэл",
  age: (age: number) => `TODO(copy): Энэ жил ${age} нас хүрнэ`,
  noChild: "TODO(copy): Хүүхдийн бүртгэл нэмнэ үү",
  loading: "TODO(copy): Мэдээлэл уншиж байна…",
  failed: "TODO(copy): Мэдээлэл уншиж чадсангүй. Дахин оролдоно уу.",
  retry: "TODO(copy): Дахин оролдох",
  settings: "TODO(copy): Тохиргоо",
} as const;
