// TODO(copy): Mongolian draft for team review (medical claims). Every exercise keeps its source;
// these are eye-rest breaks, never a treatment: no diagnosis, healthy/normal or cure wording
// (CONTRIBUTING.md). Exercises do not treat strabismus or a lazy eye.

export type Source = { label: string; url: string };
export type Step = { text: string; seconds: number };
export type Exercise = {
  key: string;
  title: string;
  summary: string;
  steps: Step[];
  /** How many times the steps run back to back. */
  rounds: number;
  source: Source;
};

const EYEWIKI_CVS: Source = {
  label: "EyeWiki (AAO): Computer Vision Syndrome",
  url: "https://eyewiki.org/Computer_Vision_Syndrome",
};
const AAO_SCREENS: Source = {
  label: "AAO: Screen Use for Kids",
  url: "https://www.aao.org/eye-health/tips-prevention/screen-use-kids",
};

export const exercises: Exercise[] = [
  {
    key: "20-20-20",
    title: "20-20-20 дүрэм",
    summary: "Дэлгэц 20 минут харсны дараа 6 метр орчим зайтай зүйл рүү 20 секунд харна.",
    steps: [{ text: "Дэлгэцээ тавиад цонхоор эсвэл холын зүйл рүү хар.", seconds: 20 }],
    rounds: 1,
    source: EYEWIKI_CVS,
  },
  {
    key: "blink",
    title: "Удаан ирмэх",
    summary:
      "Дэлгэц харж байхад ирмэх нь цөөрдөг. Удаан, бүтэн ирмэх нь нүдийг чийглэг байлгахад тусална.",
    steps: [
      { text: "Нүдээ зөөлөн аниад 2 хүртэл тоол.", seconds: 2 },
      { text: "Нүдээ нээгээд амар.", seconds: 2 },
    ],
    rounds: 5,
    source: EYEWIKI_CVS,
  },
  {
    key: "outside",
    title: "Гадаа завсарлах",
    summary: "Дэлгэцээс завсарлаж гадаа гарах нь хүүхдийн нүдэнд ээлтэй дадал.",
    steps: [{ text: "Хүүхэдтэйгээ гадаа гарч хол байгаа зүйлсийг хамт ажигла.", seconds: 120 }],
    rounds: 1,
    source: AAO_SCREENS,
  },
];

export const eyeRestCopy = {
  title: "Нүд амраах дасгал",
  sourcePrefix: "Эх сурвалж:",
  notice:
    "Энэ дасгалууд нь нүд амраах завсарлага юм. Хялар болон залхуу нүдийг эмчлэхгүй тул эмчийн зааврыг үргэлжлүүлэн дагаарай.",
} as const;
