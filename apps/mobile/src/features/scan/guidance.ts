import type { QualityReason } from "@app/core";
import type { LandmarkFrame } from "../vision/facePipeline";

// Insertion order is the priority: first fix face/eye availability, then capture conditions.
export const GUIDANCE: Record<QualityReason, string> = {
  NO_FACE: "TODO(copy): Нүүрээ хүрээнд байрлуулна уу.",
  MULTIPLE_FACES: "TODO(copy): Хүрээнд зөвхөн нэг хүн байна уу.",
  EYE_NOT_FOUND: "TODO(copy): Хоёр нүдээ камер руу харуулна уу.",
  EYES_CLOSED: "TODO(copy): Нүдээ нээнэ үү.",
  TOO_FAR: "TODO(copy): Камерт бага зэрэг ойртоно уу.",
  TOO_CLOSE: "TODO(copy): Камераас бага зэрэг холдоно уу.",
  HEAD_TURNED: "TODO(copy): Толгойгоо эгцлээд камер руу харна уу.",
  NOT_LOOKING: "TODO(copy): Камер руу харна уу.",
  TOO_DARK: "TODO(copy): Илүү гэрэлтэй орчинд оролдоно уу.",
  OVEREXPOSED: "TODO(copy): Хурц гэрлийн тусгалаас холдоно уу.",
  BLUR: "TODO(copy): Камераа хөдөлгөөнгүй барина уу.",
  REFLEX_NOT_FOUND: "TODO(copy): Камер руу харж, гэрлийн тусгалыг халхлахгүй байна уу.",
  MULTIPLE_REFLEXES: "TODO(copy): Цонх, чийдэнгийн шууд тусгалаас холдоно уу.",
};

export function guidanceForFrame(frame: LandmarkFrame | null): string {
  if (!frame) return "TODO(copy): Камер бэлдэж байна.";
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
    return "TODO(copy): Туршилтын хэмжилт бэлэн биш байна.";
  }
  return "TODO(copy): Камераа хөдөлгөөнгүй барина уу.";
}
