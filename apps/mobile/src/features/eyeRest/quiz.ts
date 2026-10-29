// TODO(copy): Mongolian draft for team review. Each answer keeps its source; no diagnosis,
// healthy/normal-eyes or cure wording (CONTRIBUTING.md).
import type { Source } from "./content";

export type QuizIcon =
  "sunny" | "phone-portrait" | "pause-circle" | "game-controller" | "hand-left";
export type QuizChoice = { text: string; icon: QuizIcon; good: boolean };
export type QuizQuestion = {
  key: string;
  choices: [QuizChoice, QuizChoice];
  /** Why the good choice helps, shown after a correct answer. */
  why: string;
  source: Source;
};

export const quizQuestions: QuizQuestion[] = [
  {
    key: "outdoors",
    choices: [
      { text: "Гадаа тоглох", icon: "sunny", good: true },
      { text: "Өдөржин утас харах", icon: "phone-portrait", good: false },
    ],
    why: "Гадаа өнгөрүүлсэн цаг хүүхдийн нүдэнд ээлтэй.",
    source: {
      label: "AAO: Prescription for Keeping Children Out of Glasses",
      url: "https://www.aao.org/eye-health/news/prevent-childhood-myopia-sunshine-outdoors",
    },
  },
  {
    key: "breaks",
    choices: [
      { text: "Зогсолтгүй тоглоом тоглох", icon: "game-controller", good: false },
      { text: "Дэлгэцээс завсарлах", icon: "pause-circle", good: true },
    ],
    why: "Дэлгэц удаан харахад нүд ядардаг тул хааяа завсарлаарай.",
    source: {
      label: "EyeWiki (AAO): Computer Vision Syndrome",
      url: "https://eyewiki.org/Computer_Vision_Syndrome",
    },
  },
  {
    key: "distance",
    choices: [
      { text: "Утсаа гарын урттай хол барих", icon: "hand-left", good: true },
      { text: "Утсаа нүдэндээ ойртуулах", icon: "phone-portrait", good: false },
    ],
    why: "Дэлгэцийг гарын урттай тэнцэх зайд барих нь зүйтэй.",
    source: {
      label: "AAO: Screen Use for Kids",
      url: "https://www.aao.org/eye-health/tips-prevention/screen-use-kids",
    },
  },
];

export const quizCopy = {
  key: "quiz",
  title: "Зөв зуршил сонгоё",
  summary: "Нүдэнд ээлтэй зуршлуудаас зөвийг нь сонгоорой.",
  tag: "МИНИ ТОГЛООМ",
  prompt: "Аль нь нүдэнд ээлтэй вэ?",
  question: (current: number, total: number) => `Асуулт ${current}/${total}`,
  right: "Зөв! Сайн байна!",
  wrong: "Үгүй ээ, нөгөөг нь сонгоод үзээрэй.",
  next: "Дараагийнх",
  done: "Бүгдийг нь зөв сонголоо!",
  again: "Дахин тоглох",
} as const;
