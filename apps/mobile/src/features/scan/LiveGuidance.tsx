import { useEffect, useRef } from "react";
import { Card, Text } from "../../components/ui";
import type { LandmarkFrame } from "../vision/facePipeline";
import { nextVoice, type VoiceGate } from "../voice/guidanceVoice";
import { useVoice } from "../voice/useVoice";
import { guidanceForFrame } from "./guidance";
import { initialSteady, nextSteady } from "./steadyGuidance";

export function LiveGuidance({
  frame,
  speak = false,
}: {
  frame: LandmarkFrame | null;
  /** Read the steady instruction aloud (while aligning), so the parent can watch the child. */
  speak?: boolean;
}) {
  const steady = useRef(initialSteady);
  const lastFrame = useRef<LandmarkFrame | null | undefined>(undefined);
  // Feed each frame once, even if the component re-renders for another reason.
  if (lastFrame.current !== frame) {
    lastFrame.current = frame;
    steady.current = nextSteady(steady.current, guidanceForFrame(frame));
  }

  const { say } = useVoice();
  const gate = useRef<VoiceGate>({ key: null, atMs: 0 });
  useEffect(() => {
    // Leave room for the scan's own intro prompt before the first instruction.
    if (speak) gate.current = { key: null, atMs: performance.now() };
  }, [speak]);
  const shown = steady.current.shown;
  useEffect(() => {
    if (!speak) return;
    const next = nextVoice(gate.current, shown, performance.now());
    gate.current = next.gate;
    if (next.speak) say(next.speak);
  });

  return (
    <Card pointerEvents="none">
      <Text accessibilityLiveRegion="polite">{shown}</Text>
    </Card>
  );
}
