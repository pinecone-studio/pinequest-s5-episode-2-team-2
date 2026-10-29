// Matches the owner's screenshot/web-demo copy (2026-10-28); controls reuse existing app wording.
export const distanceCopy = {
  title: "Зай хэмжих",
  help: "Урд камер шалгуулж буй хүний зайг ойролцоогоор тооцно. Хүүхдийн хувьд зайг метрээр хэмжиж тэмдэглэх нь илүү найдвартай.",
  back: "Буцах",
  retry: "Дахин шалгах",
  unavailable: "Камер асахгүй байна. 3 метрийг хэмжээд үргэлжлүүлж болно.",
  farther: "Арай холдоорой",
  closer: "Арай ойртоорой",
  ready: "Зөв зайд байна",
  proceed: "Зай зөв, эхлэх 👍",
  metres: (value: number) => `≈ ${value.toFixed(1)} м`,
} as const;
