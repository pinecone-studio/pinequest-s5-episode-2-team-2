// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
export const historyCopy = {
  title: "Түүх",
  noChild: "Түүх хадгалахын тулд хүүхдийн профайл нэмнэ үү",
  // TODO(copy): team approval pending for this new label.
  unassigned: "TODO(copy): Профайлд холбоогүй шалгалтууд",
  empty: "Хадгалсан шалгалт алга байна",
  failed: "Түүхийг ачаалж чадсангүй. Дахин оролдоно уу.",
  retry: "Дахин оролдох",
  open: "Шалгалтын дэлгэрэнгүй",
  all: (n: number) => `Бүгд ${n}`,
  // Short result names on the filter chips, shown next to the result symbol (#236).
  chips: {
    REFER: "Эмчид хандах",
    RETAKE: "Дахин авах",
    NOT_ASSESSED: "Үнэлэх боломжгүй",
    NO_VISIBLE_SIGN: "Шинж ажиглагдаагүй",
  },
  noneWithOutcome: "Энэ үр дүнтэй шалгалт алга",
  detail: {
    title: "Шалгалтын дэлгэрэнгүй",
    missing: "Энэ шалгалт устсан байна",
    frames: (used: number, total: number) => `Ашигласан кадр: ${used} / ${total}`,
    score: "Тэгш бус байдлын үзүүлэлт (хэмжилт, онош биш)",
    technical: "Техникийн мэдээлэл",
    delete: "Шалгалтыг устгах",
    confirmTitle: "Энэ шалгалтыг устгах уу?",
    confirmBody: "Устгасны дараа сэргээх боломжгүй.",
    cancel: "Болих",
    deleteFailed: "Устгаж чадсангүй. Дахин оролдоно уу.",
  },
} as const;
