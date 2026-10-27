// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
export const treatmentCopy = {
  title: "Эмчилгээ",
  noChild: "Эхлээд хүүхдийн профайл нэмнэ үү",
  kinds: { patch: "Нүдний наалт", glasses: "Нүдний шил" },
  today: "Өнөөдөр",
  minutes: (n: number) => `${n} минут`,
  goal: "Эмчийн заасан өдрийн зорилго (минут)",
  noGoal: "Зорилго тавиагүй",
  saveGoal: "Зорилго хадгалах",
  invalidGoal: "1-ээс 1440 хүртэлх бүхэл минут оруулна уу",
  start: "Эхлэх",
  stop: "Зогсоох",
  running: "Явагдаж байна",
  failed: "Хадгалж чадсангүй. Дахин оролдоно уу.",
  week: "Сүүлийн 7 өдөр",
  // Day of the month only, so the axis needs no translated weekday names.
  weekday: (day: Date) => String(day.getDate()),
  streak: (days: number) => `Зорилгодоо дараалан ${days} өдөр хүрсэн`,
  dayLabel: (day: Date, minutes: number, met: boolean | null) =>
    `${day.getMonth() + 1}/${day.getDate()}: ${minutes} минут` +
    (met === null ? "" : met ? ", зорилгод хүрсэн" : ", зорилгод хүрээгүй"),
} as const;
