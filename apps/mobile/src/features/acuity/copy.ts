import type { AgeGroup, Eye } from "./acuity";

// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
export const acuityCopy = {
  title: "Хараа шалгах",
  who: "Хэнийг шалгах вэ?",
  groups: {
    child3: "Хүүхэд, 3 настай",
    child4: "Хүүхэд, 4 настай",
    child5: "Хүүхэд, 5 ба түүнээс дээш",
    adult: "Насанд хүрэгч",
  } satisfies Record<AgeGroup, string>,
  setup:
    "Утсаа хүүхдийн нүдний түвшинд, 3 метр орчим зайд барина уу. Хүүхэд Е үсгийн хөл аль зүг рүү харж байгааг гараараа заана, та тэр сумыг дарна.",
  cover: (eye: Eye) =>
    eye === "right"
      ? "ЗҮҮН нүдийг алгаараа эсвэл картаар таглана уу. БАРУУН нүдийг шалгана."
      : "Одоо БАРУУН нүдийг таглана уу. ЗҮҮН нүдийг шалгана.",
  ready: "Нүдээ тагласан, эхлэх",
  progress: (level: number, total: number) => `Хэмжээ ${level} / ${total}`,
  up: "Дээш",
  down: "Доош",
  left: "Зүүн",
  right: "Баруун",
  cantSee: "Харагдахгүй байна",
  resultTitle: "Хараа шалгасан үр дүн",
  eyeLabel: (eye: Eye) => (eye === "right" ? "Баруун нүд" : "Зүүн нүд"),
  belowChart: "Хүснэгтээс доош",
  refer: "Нүдний эмчид үзүүлэхийг зөвлөж байна.",
  noSign: "Энэ шалгалтаар шинж илрээгүй.",
  notice: "Энэ шалгалт онош тавихгүй бөгөөд нүдний эмчийн үзлэгийг орлохгүй.",
  save: "Түүхэнд хадгалах",
  saved: "Түүхэнд хадгалагдлаа",
  failed: "Хадгалж чадсангүй. Дахин оролдоно уу.",
  noChild: "Үр дүнг хадгалахын тулд хүүхдийн профайл нэмнэ үү",
  again: "Дахин шалгах",
  done: "Дуусгах",
} as const;
