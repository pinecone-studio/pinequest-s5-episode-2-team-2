// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
export const habitsCopy = {
  title: "Эрүүл дадал",
  noChild: "Эхлээд хүүхдийн профайл нэмнэ үү",
  today: "Өнөөдөр",
  outdoor: "Гадаа өнгөрүүлсэн хугацаа",
  outdoorTotal: (min: number) => `${min} минут`,
  addMinutes: (min: number) => `+${min} минут`,
  screenBreaks: "Дэлгэцээс завсарлах",
  breakTotal: (n: number) => `${n} удаа`,
  addBreak: "+1 завсарлага",
  remindersTitle: "Сануулга",
  remindersNote: "Сануулга энэ утсан дээр мэдэгдэл хэлбэрээр ирнэ.",
  permissionDenied: "Хадгалагдлаа, гэхдээ мэдэгдэл унтраастай байна. Тохиргооноос зөвшөөрнө үү.",
  notification: (kind: "outdoor" | "screen_break" | "rescan", name: string) =>
    ({
      outdoor: { title: "Гадаа гарах цаг", body: `${name}-тай гадаа гараарай` },
      screen_break: { title: "Дэлгэцээс завсарлах", body: `${name}, нүдээ амраагаарай` },
      rescan: { title: "Нүдний шалгалт", body: `${name}-ийн нүдийг дахин шалгах цаг боллоо` },
    })[kind],
  reminderLabels: {
    outdoor: "Гадаа гарах (өдөр бүр, ЦЦ:ММ)",
    screen_break: "Дэлгэцээс завсарлах (өдөр бүр, ЦЦ:ММ)",
    rescan: "Дахин шалгах (хэд хоногийн дараа)",
  },
  save: "Хадгалах",
  saved: "Хадгалагдлаа",
  invalid: "Цагийг (ЦЦ:ММ) эсвэл хоногийг (1–365) шалгана уу",
  failed: "Хадгалж чадсангүй. Дахин оролдоно уу.",
} as const;
