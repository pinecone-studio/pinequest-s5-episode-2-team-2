// Voice-over script for Нүдхэний ертөнц. Only the butterfly eye exercise is recorded so far; the
// other games show these lines as text and play the existing chime. To add a clip: record it under the file name below, put
// it in assets/sounds/voice/, register it in src/features/voice/clips.ts and call `say` where
// the line appears. The text always comes from copy.ts, so script and screen never drift.
import {
  clinicCopy,
  eyeMovesCopy,
  gardenCopy,
  photoCopy,
  rescueCopy,
  spaceCopy,
  styleCopy,
  worldCopy,
} from "./copy";

export const worldVoiceScript: { file: string; text: string }[] = [
  { file: "world-welcome.m4a", text: `${worldCopy.title}! ${worldCopy.subtitle}` },
  { file: "rescue-intro.m4a", text: rescueCopy.intro },
  { file: "rescue-phone.m4a", text: rescueCopy.phone.task },
  { file: "rescue-phone-done.m4a", text: rescueCopy.phone.done },
  { file: "rescue-glare.m4a", text: rescueCopy.glare.task },
  { file: "rescue-glare-done.m4a", text: rescueCopy.glare.done },
  { file: "rescue-rest.m4a", text: rescueCopy.rest.task },
  { file: "rescue-try-other.m4a", text: rescueCopy.rest.tryOther },
  { file: "rescue-done.m4a", text: rescueCopy.finished },
  { file: "space-intro.m4a", text: spaceCopy.intro },
  { file: "space-task.m4a", text: spaceCopy.task },
  { file: "space-correct.m4a", text: spaceCopy.correct },
  { file: "space-done.m4a", text: spaceCopy.finished },
  { file: "garden-choose.m4a", text: gardenCopy.chooseBreak },
  { file: "garden-encourage.m4a", text: gardenCopy.encourage },
  { file: "garden-confirm.m4a", text: gardenCopy.confirm },
  { file: "garden-seed.m4a", text: gardenCopy.seedEarned },
  { file: "photo-intro.m4a", text: photoCopy.intro },
  { file: "photo-task.m4a", text: photoCopy.task },
  { file: "photo-good.m4a", text: photoCopy.good },
  { file: "photo-done.m4a", text: photoCopy.finished },
  { file: "clinic-intro.m4a", text: clinicCopy.intro },
  ...Object.entries(clinicCopy.cases).map(([key, item]) => ({
    file: `clinic-${key}.m4a`,
    text: `${item.says} ${item.ask}`,
  })),
  { file: "clinic-good.m4a", text: clinicCopy.good },
  { file: "clinic-done.m4a", text: clinicCopy.finished },
  { file: "style-welcome.m4a", text: styleCopy.heading },
  // Recorded and playing: the butterfly's lines (assets/sounds/voice/eyes-*.m4a).
  ...Object.entries(eyeMovesCopy.voice).map(([key, text]) => ({ file: `${key}.m4a`, text })),
];
