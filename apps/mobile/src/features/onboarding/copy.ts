// Mongolian app copy, approved by the team lead (#30).
// Copy rules: CONTRIBUTING.md "App copy" (no diagnosis, no "healthy/normal" wording).
export const onboardingPages = [
  {
    key: "purpose",
    title: "Нүдний гэрэл",
    body: "Хүүхдийн нүдэнд туссан гэрлийн тусгалыг 3 секундэд шалгаж, нүдний эмчид хандах хэрэгтэй эсэхийг зөвлөнө.",
  },
  {
    key: "limits",
    title: "Онош тавихгүй",
    body: "Энэ апп онош тавихгүй бөгөөд нүдний эмчийн үзлэгийг орлохгүй. Санаа зовж байвал нүдний эмчид хандаарай.",
  },
  {
    key: "privacy",
    title: "Зураг утаснаас гарахгүй",
    body: "Бүх шинжилгээ энэ утсан дээр хийгдэнэ. Зураг хадгалахгүй, интернэтээр илгээхгүй.",
  },
  {
    key: "how",
    title: "Хэрхэн шалгах вэ",
    body: "Утсаа хүүхдийн нүдний түвшинд, 35 см орчим зайд барина. Хүүхэд камерын гэрэл рүү харж байхад 3 секунд шалгана.",
  },
] as const;

export const onboardingCopy = {
  step: (current: number, total: number) => `${current} / ${total}`,
  consent: "Би уншиж танилцсан бөгөөд энэ апп онош тавихгүйг ойлгосон",
  next: "Дараах",
  back: "Буцах",
  accept: "Зөвшөөрөөд үргэлжлүүлэх",
  saveError: "Хадгалж чадсангүй, дахин оролдоно уу",
} as const;
