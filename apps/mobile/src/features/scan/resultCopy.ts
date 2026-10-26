import type { Outcome, ReasonCode } from "@app/core";

// TODO(copy): Mongolian placeholders; the team must approve the final wording.
export const resultCopy = {
  title: "Шинжилгээний үр дүн",
  empty: "Үр дүн алга. Шалгалт эхлүүлнэ үү.",
  mock: "Жишээ үр дүн. Камерын зурагт шинжилгээ хийгээгүй.",
  illustration: "Жишээ дүрслэл · зураг хадгалахгүй",
  reasons: "Шалтгаан",
  next: "Зөвлөмж",
  notice: "Энэ апп онош тавихгүй, нүдний эмчийн үзлэгийг орлохгүй.",
  retry: "Дахин шалгах",
  back: "Буцах",
  save: "Үр дүнг хадгалах",
  saving: "Хадгалж байна…",
  saved: "Үр дүн хадгалагдлаа",
  failed: "Хадгалж чадсангүй. Дахин оролдоно уу.",
  unassigned: "Хүүхэд сонгоогүй тул нэргүй үр дүнгээр хадгалагдана.",
};
export const outcomeCopy = {
  REFER: {
    icon: "!",
    title: "Нүдний эмчид хандаарай",
    explanation: "Эмчид үзүүлэхийг зөвлөж байна.",
    next: "Нүдний эмчийн үзлэгт цаг аваарай.",
    color: "#986000",
    background: "#FFF6E7",
  },
  RETAKE: {
    icon: "↻",
    title: "Дахин зураг аваарай",
    explanation: "Зургийн чанар үнэлгээ хийхэд хангалтгүй байна.",
    next: "Гэрэлтүүлэг, байрлалаа тохируулаад дахин шалгаарай.",
    color: "#986000",
    background: "#FFF6E7",
  },
  NOT_ASSESSED: {
    icon: "?",
    title: "Үнэлэх боломжгүй",
    explanation: "Энэ шалгалтаар зөвлөмж гаргах боломжгүй байна.",
    next: "Дахин оролдоорой. Асуудал үргэлжилбэл нүдний эмчид хандаарай.",
    color: "#6251A1",
    background: "#F2EEFF",
  },
  NO_VISIBLE_SIGN: {
    icon: "✓",
    title: "Шинж ажиглагдаагүй",
    explanation: "Энэ нь нүд эрүүл гэсэн баталгаа биш.",
    next: "Нүдний зовиур, өөрчлөлт ажиглагдвал эмчид хандаарай.",
    color: "#176D5C",
    background: "#EAF8F3",
  },
} satisfies Record<
  Outcome,
  {
    icon: string;
    title: string;
    explanation: string;
    next: string;
    color: string;
    background: string;
  }
>;
export const reasonCopy: Record<ReasonCode, string> = {
  NO_FACE: "Нүүр илрээгүй",
  MULTIPLE_FACES: "Олон нүүр илэрсэн",
  EYE_NOT_FOUND: "Нүдийг ялгаж чадсангүй",
  EYES_CLOSED: "Нүд аниатай",
  BLUR: "Зураг бүдэг",
  TOO_DARK: "Гэрэл бага",
  OVEREXPOSED: "Гэрэл хэт их",
  TOO_FAR: "Камераас хэт хол",
  TOO_CLOSE: "Камерт хэт ойр",
  HEAD_TURNED: "Толгой хазайсан",
  NOT_LOOKING: "Хараа камер луу чиглээгүй",
  REFLEX_NOT_FOUND: "Гэрлийн тусгал илрээгүй",
  MULTIPLE_REFLEXES: "Олон гэрлийн тусгал илэрсэн",
  ASYMMETRY_ABOVE_THRESHOLD: "Хэмжилтийн зөрүү босгоос давсан",
  LOW_CONSISTENCY: "Хэмжилтүүд тогтворгүй",
  TOO_FEW_FRAMES: "Ашиглах зураг хангалтгүй",
  MODEL_UNAVAILABLE: "Шалгах загвар бэлэн биш",
  MODEL_ERROR: "Шалгалтын боловсруулалт амжилтгүй",
  TIMEOUT: "Шалгалтын хугацаа хэтэрсэн",
};
