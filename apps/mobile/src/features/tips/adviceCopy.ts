// TODO(copy): navigation/status labels for team review; medical advice stays in content.ts.
export const adviceCopy = {
  daily: "Өнөөдрийн зөвлөгөө",
  topics: "Нүдэнд ээлтэй зөвлөгөө",
  details: "Дэлгэрэнгүй",
  openHint: "Бүрэн зөвлөгөө болон эх сурвалжийг нээнэ",
  loading: "Зураг ачаалж байна",
  imageUnavailable: "Зураг ачаалсангүй",
  missing: "Зөвлөгөө олдсонгүй",
  browse: "Бүх зөвлөгөөг үзэх",
  sourceFailed: "Эх сурвалжийг нээж чадсангүй. Холбоосыг дахин дарж оролдоно уу.",
  page: (index: number, count: number, title: string) => `${index} / ${count}: ${title}`,
} as const;
