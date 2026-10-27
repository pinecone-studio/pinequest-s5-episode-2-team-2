import type { QualityReason } from "@app/core";
import type { LandmarkFrame } from "../vision/facePipeline";

// Insertion order is the priority: first fix face/eye availability, then capture conditions.
export const GUIDANCE: Record<QualityReason, string> = {
  NO_FACE: "Нүүрээ хүрээнд байрлуулна уу.",
  MULTIPLE_FACES: "Хүрээнд зөвхөн нэг хүн байна уу.",
  EYE_NOT_FOUND: "Хоёр нүдээ камер руу харуулна уу.",
  EYES_CLOSED: "Нүдээ нээнэ үү.",
  TOO_FAR: "Камерт бага зэрэг ойртоно уу.",
  TOO_CLOSE: "Камераас бага зэрэг холдоно уу.",
  HEAD_TURNED: "Толгойгоо эгцлээд камер руу харна уу.",
  NOT_LOOKING: "Камер руу харна уу.",
  TOO_DARK: "Илүү гэрэлтэй орчинд оролдоно уу.",
  OVEREXPOSED: "Хурц гэрлийн тусгалаас холдоно уу.",
  BLUR: "Камераа хөдөлгөөнгүй барина уу.",
  REFLEX_NOT_FOUND: "Камер руу харж, гэрлийн тусгалыг халхлахгүй байна уу.",
  MULTIPLE_REFLEXES: "Цонх, чийдэнгийн шууд тусгалаас холдоно уу.",
};

export function guidanceForFrame(frame: LandmarkFrame | null): string {
  if (!frame) return "Камер бэлдэж байна.";
  if (frame.faceCount === 0) return GUIDANCE.NO_FACE;
  if (frame.faceCount > 1) return GUIDANCE.MULTIPLE_FACES;
  const modelUnavailable =
    frame.eyeFailure === "MODEL_ERROR" || frame.eyeFailure === "MODEL_UNAVAILABLE";
  const reasons = frame.quality?.reasons ?? [];
  const reason = (Object.keys(GUIDANCE) as QualityReason[]).find(
    (code) => reasons.includes(code) && !(modelUnavailable && code === "EYE_NOT_FOUND"),
  );
  if (reason) return GUIDANCE[reason];
  if (frame.eyeFailure === "EYE_NOT_FOUND") return GUIDANCE.EYE_NOT_FOUND;
  if (modelUnavailable) {
    return "Туршилтын хэмжилт бэлэн биш байна.";
  }
  return "Камераа хөдөлгөөнгүй барина уу.";
}
