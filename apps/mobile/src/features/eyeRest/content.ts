// TODO(copy): Mongolian draft for team review (medical claims). Every exercise keeps its source;
// these are eye-rest breaks, never a treatment: no diagnosis, healthy/normal or cure wording
// (CONTRIBUTING.md). Exercises do not treat strabismus or a lazy eye.

import type { VoiceKey } from "../voice/clips";

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
  /** #eye-rest-games: the card's picture tile and its small label. */
  icon: "leaf" | "partly-sunny" | "flower";
  tint: { background: string; foreground: string };
  tag: string;
  /** Recorded prompts: an intro before the first step, one per step, and one at the end. */
  voice?: { intro: VoiceKey; steps: VoiceKey[]; done: VoiceKey };
};

const EYEWIKI_CVS: Source = {
  label: "EyeWiki (AAO): Computer Vision Syndrome",
  url: "https://eyewiki.org/Computer_Vision_Syndrome",
};

export const exercises: Exercise[] = [
  {
    key: "outside",
    title: "Эрдэнэсийн ан",
    summary: "Том хүнтэйгээ гадаа гараад хол байгаа 3 зүйл олоорой.",
    steps: [
      { text: "Том хүнтэйгээ хамт гадаа гараарай.", seconds: 30 },
      { text: "Хамгийн хол байгаа модыг олоорой.", seconds: 90 },
      { text: "Тэнгэрээс үүл хайгаарай.", seconds: 90 },
      { text: "Хол явж байгаа машин эсвэл шувуу олоорой.", seconds: 90 },
    ],
    rounds: 1,
    source: {
      label: "AAO: Prescription for Keeping Children Out of Glasses",
      url: "https://www.aao.org/eye-health/news/prevent-childhood-myopia-sunshine-outdoors",
    },
    icon: "leaf",
    tint: { background: "#DDF5E6", foreground: "#1F7A45" },
    tag: "ГАДАА · 5 МИН",
  },
  {
    key: "20-20-20",
    title: "Нүдхэнтэй амаръя",
    summary: "Дэлгэцээс харцаа салгаж холыг 20 секунд хараарай.",
    steps: [{ text: "Дэлгэцээ тавиад цонхоор хол хараарай. Дуу гарахаар буцаад ир!", seconds: 20 }],
    rounds: 1,
    source: EYEWIKI_CVS,
    icon: "partly-sunny",
    tint: { background: "#DCEBFF", foreground: "#2559C4" },
    tag: "АМРАЛТ · 20 СЕК",
  },
  {
    key: "blink",
    title: "Эрвээхэйн далавч",
    summary: "Эрвээхэй далавчаа дэвэх шиг нүдээ удаан ирмээрэй.",
    steps: [
      { text: "Нүдээ зөөлөн ань. Далавч хумигдлаа.", seconds: 2 },
      { text: "Нүдээ нээ. Далавч дэлгэгдлээ.", seconds: 2 },
    ],
    rounds: 5,
    source: EYEWIKI_CVS,
    icon: "flower",
    tint: { background: "#FFE4EC", foreground: "#B0335F" },
    tag: "АМРАЛТ · 20 СЕК",
    voice: { intro: "blink-start", steps: ["blink-close", "blink-open"], done: "blink-done" },
  },
];

export const eyeRestCopy = {
  title: "Нүд амраах дасгал",
  screenTitle: "Тоглоом",
  stars: (count: number) => `${count} од`,
  starEarned: "+1 од авлаа!",
  dailyTitle: "Өнөөдрийн адал явдал",
  dailyBody: "3 даалгаврыг биелүүлээд од цуглуулаарай",
  dailyNoChild: "Од хадгалахын тулд хүүхдийн профайл нэмээрэй",
  dailyProgress: (done: number, goal: number) => `Өнөөдөр ${done}/${goal} од`,
  doneToday: "Өнөөдөр хийсэн",
  heroTitle: "Нүдхэнтэй тоглоё!",
  heroSubtitle: "Бяцхан даалгавар, том инээмсэглэл",
  section: "Адал явдлууд",
  sourcePrefix: "Эх сурвалж:",
  start: "Эхлэх",
  stop: "Зогсоох",
  again: "Дахин хийх",
  done: "Дууслаа. Нүдээ амраасанд баярлалаа!",
  round: (current: number, total: number) => `Давталт ${current}/${total}`,
  step: (current: number, total: number) => `Алхам ${current}/${total}`,
  secondsLeft: (seconds: number) => `${seconds} сек`,
  secondsUnit: "сек",
  getReady: "Бэлдээрэй!",
  progress: "Дасгалын явц",
  back: "Дасгалууд руу буцах",
  openFromTips: "Нүд амраах дасгал хийх",
  notice:
    "Энэ дасгалууд нь нүд амраах завсарлага юм. Хялар болон залхуу нүдийг эмчлэхгүй тул эмчийн зааврыг үргэлжлүүлэн дагаарай.",
} as const;
