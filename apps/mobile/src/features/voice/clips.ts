// Recorded Mongolian voice prompts (one speaker, trimmed and level-matched). The wording is the
// approved app copy, plus short child-facing lines marked TODO(copy) in the scripts.
import blinkStart from "../../../assets/sounds/voice/blink-start.m4a";
import blinkClose from "../../../assets/sounds/voice/blink-close.m4a";
import blinkOpen from "../../../assets/sounds/voice/blink-open.m4a";
import blinkDone from "../../../assets/sounds/voice/blink-done.m4a";
import scanIntro from "../../../assets/sounds/voice/scan-intro.m4a";
import scanNoFace from "../../../assets/sounds/voice/scan-no-face.m4a";
import scanEyesClosed from "../../../assets/sounds/voice/scan-eyes-closed.m4a";
import scanTooFar from "../../../assets/sounds/voice/scan-too-far.m4a";
import scanTooClose from "../../../assets/sounds/voice/scan-too-close.m4a";
import scanHeadTurned from "../../../assets/sounds/voice/scan-head-turned.m4a";
import scanNotLooking from "../../../assets/sounds/voice/scan-not-looking.m4a";
import scanTooDark from "../../../assets/sounds/voice/scan-too-dark.m4a";
import scanBlur from "../../../assets/sounds/voice/scan-blur.m4a";
import scanHold from "../../../assets/sounds/voice/scan-hold.m4a";
import scanDone from "../../../assets/sounds/voice/scan-done.m4a";
import acuityIntro from "../../../assets/sounds/voice/acuity-intro.m4a";
import acuityPractice from "../../../assets/sounds/voice/acuity-practice.m4a";
import acuityCorrect from "../../../assets/sounds/voice/acuity-correct.m4a";
import acuityWrong from "../../../assets/sounds/voice/acuity-wrong.m4a";
import acuityGreat from "../../../assets/sounds/voice/acuity-great.m4a";
import acuityCoverLeft from "../../../assets/sounds/voice/acuity-cover-left.m4a";
import acuityCoverRight from "../../../assets/sounds/voice/acuity-cover-right.m4a";
import acuityThumb from "../../../assets/sounds/voice/acuity-thumb.m4a";
import acuityNext from "../../../assets/sounds/voice/acuity-next.m4a";
import acuityDone from "../../../assets/sounds/voice/acuity-done.m4a";

export const VOICE_CLIPS = {
  "blink-start": blinkStart,
  "blink-close": blinkClose,
  "blink-open": blinkOpen,
  "blink-done": blinkDone,
  "scan-intro": scanIntro,
  "scan-no-face": scanNoFace,
  "scan-eyes-closed": scanEyesClosed,
  "scan-too-far": scanTooFar,
  "scan-too-close": scanTooClose,
  "scan-head-turned": scanHeadTurned,
  "scan-not-looking": scanNotLooking,
  "scan-too-dark": scanTooDark,
  "scan-blur": scanBlur,
  "scan-hold": scanHold,
  "scan-done": scanDone,
  "acuity-intro": acuityIntro,
  "acuity-practice": acuityPractice,
  "acuity-correct": acuityCorrect,
  "acuity-wrong": acuityWrong,
  "acuity-great": acuityGreat,
  "acuity-cover-left": acuityCoverLeft,
  "acuity-cover-right": acuityCoverRight,
  "acuity-thumb": acuityThumb,
  "acuity-next": acuityNext,
  "acuity-done": acuityDone,
} as const;

export type VoiceKey = keyof typeof VOICE_CLIPS;
