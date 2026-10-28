// TODO(copy): owner approval pending for the distance setup copy.
export const distanceCopy = {
  title: "TODO(copy): Зай хэмжих",
  help: "TODO(copy): Утсаа нүдний түвшинд тогтвортой байрлуулаад, нэг хүн нүүрээ камерын голд харуулна. Зорилтот зай: 3 м.",
  privacy: "Зураг хадгалахгүй, утаснаас гаргахгүй.",
  open: "TODO(copy): Камер нээх",
  close: "TODO(copy): Камер хаах",
  unknown: "TODO(copy): Зайг хэмжиж чадсангүй. Нүүрээ камерын голд байрлуулна уу.",
  unavailable: "TODO(copy): Энэ камераар зай хэмжих боломжгүй. 3 м зайг туузан метрээр шалгаарай.",
  approximate:
    "TODO(copy): Ойролцоо хэмжилт. Харааны шалгалтын зайг туузан метрээр баталгаажуулаарай.",
  swap: "TODO(copy): Камер солих",
  proceed: "TODO(copy): Харааны шалгалт руу үргэлжлүүлэх",
  metres: (value: number) => `≈ ${value.toFixed(1)} м`,
} as const;
