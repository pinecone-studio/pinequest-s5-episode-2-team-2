import { tipSections, type Tip } from "./content";

export type AdviceId = "early-checks" | "screen-time" | "outdoor-time" | "doctor-signs";
export type AdviceCard = {
  id: AdviceId;
  title: string;
  summary: string;
  tips: readonly Tip[];
};

const sectionTips = (key: string) => tipSections.find((section) => section.key === key)?.tips ?? [];
const why = sectionTips("why");
const habits = sectionTips("habits");
const signs = sectionTips("signs");

// TODO(copy): short navigation labels for team review. Medical copy and sources below
// are references to the existing team-written content, never rewritten summaries.
const groups: { id: AdviceId; title: string; tips: Tip[]; summaryIndex?: number }[] = [
  { id: "early-checks", title: "Яагаад эрт шалгах нь чухал вэ?", tips: why, summaryIndex: 2 },
  { id: "screen-time", title: "Дэлгэцийн хэрэглээ", tips: [habits[0], habits[2]].filter(isTip) },
  { id: "outdoor-time", title: "Гадаа өнгөрүүлэх цаг", tips: [habits[1]].filter(isTip) },
  { id: "doctor-signs", title: "Нүдний эмчид хэзээ хандах вэ?", tips: signs },
];

function isTip(tip: Tip | undefined): tip is Tip {
  return tip !== undefined;
}

export const adviceCards: readonly AdviceCard[] = groups.flatMap((group) => {
  const summary = group.tips[group.summaryIndex ?? 0] ?? group.tips[0];
  return summary ? [{ id: group.id, title: group.title, summary: summary.text, tips: group.tips }] : [];
});

export function findAdvice(id: string | undefined): AdviceCard | undefined {
  return adviceCards.find((card) => card.id === id);
}
