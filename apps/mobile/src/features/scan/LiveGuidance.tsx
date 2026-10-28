import { useRef } from "react";
import { Card, Text } from "../../components/ui";
import type { LandmarkFrame } from "../vision/facePipeline";
import { guidanceForFrame } from "./guidance";
import { initialSteady, nextSteady } from "./steadyGuidance";

export function LiveGuidance({ frame }: { frame: LandmarkFrame | null }) {
  const steady = useRef(initialSteady);
  const lastFrame = useRef<LandmarkFrame | null | undefined>(undefined);
  // Feed each frame once, even if the component re-renders for another reason.
  if (lastFrame.current !== frame) {
    lastFrame.current = frame;
    steady.current = nextSteady(steady.current, guidanceForFrame(frame));
  }
  return (
    <Card pointerEvents="none">
      <Text accessibilityLiveRegion="polite">{steady.current.shown}</Text>
    </Card>
  );
}
