import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Button, Text } from "../../components/ui";
import { useReduceMotion } from "../../components/useReduceMotion";
import { fonts } from "../../theme";
import { eyeMovesCopy as copy, worldCopy } from "./copy";
import type { VoiceKey } from "../voice/clips";
import { useVoice } from "../voice/useVoice";
import {
  MOVE_LEAD_SECONDS,
  eyeCueTimes,
  eyeMovePath,
  eyeMovePoint,
  eyeRoutine,
  stepSeconds,
  type Direction,
  type EyeMove,
  type EyeStep,
} from "./logic";
import { GameCompletion, GameIntro, GameShell, useSuccessSound, world } from "./ui";

const BUTTERFLY = 56;
// Room between the butterfly and the edge of its sky.
const MARGIN = 12;
const DAY = [world.lavender, world.mint] as const;
const NIGHT = ["#D9CCFF", "#7C68D6", "#4C3B9E"] as const;
const ARROW: Record<EyeMove, string> = {
  sideways: "↔",
  upDown: "↕",
  diagonalUp: "⤢",
  diagonalDown: "⤡",
  circleRight: "↻",
  circleLeft: "↺",
  eight: "∞",
};
type Area = { width: number; height: number };
/** The butterfly's recorded words for each direction it flies. */
const CUE_VOICE: Record<Direction, VoiceKey> = {
  left: "eyes-left",
  right: "eyes-right",
  up: "eyes-up",
  down: "eyes-down",
};
/** The "done" line waits for the chime that opens the eyes. */
const DONE_VOICE_DELAY_MS = 700;

/**
 * Эрвээхэйтэй нүдний дасгал: follow a butterfly with the eyes, head still, through every
 * direction, then blink quickly and rest with closed eyes until a chime. A screen break for
 * children and adults; it never checks, measures or treats the eyes.
 */
export function EyeMovesGame({
  onComplete,
  onExit,
}: {
  onComplete: () => Promise<string | null>;
  onExit: () => void;
}) {
  const [stage, setStage] = useState<"intro" | "play" | "done">("intro");
  const [index, setIndex] = useState(0);
  const [starNote, setStarNote] = useState<string | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const steps = useMemo(() => eyeRoutine(), []);
  const step = steps[index]!;
  const still = useReduceMotion();
  const success = useSuccessSound();
  const { say } = useVoice();
  // The voice is a bonus: a clip that fails to play must never stop the exercise.
  const sayRef = useRef(say);
  useEffect(() => {
    sayRef.current = say;
  });
  const speak = useCallback((key: VoiceKey) => {
    try {
      sayRef.current(key);
    } catch {
      // The words on screen still guide the child.
    }
  }, []);

  const advance = useCallback(() => {
    if (index + 1 < steps.length) return setIndex(index + 1);
    // The chime tells closed eyes that the rest is over.
    success();
    setStage("done");
    void onComplete().then(setStarNote, () => setStarNote(null));
  }, [index, steps.length, success, onComplete]);

  // Each step's timer starts once per step; a new callback from the parent never restarts it.
  const latest = useRef(advance);
  useEffect(() => {
    latest.current = advance;
  });
  useEffect(() => {
    if (stage !== "play") return;
    const timer = setTimeout(() => latest.current(), Math.round(stepSeconds(step) * 1000));
    return () => clearTimeout(timer);
  }, [stage, index, step]);

  // The butterfly talks: hello on the intro screen, "Эрвээхэйг дагаарай!" before each move and
  // the direction as it reaches each edge in the first round, then the blink, rest and goodbye.
  // A new step, skip or leaving the game cancels any word still waiting.
  useEffect(() => {
    if (stage === "intro") speak("eyes-start");
    if (stage === "done") {
      const timer = setTimeout(() => speak("eyes-done"), DONE_VOICE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [stage, speak]);
  useEffect(() => {
    if (stage !== "play") return;
    const current = steps[index]!;
    if (current.kind !== "move")
      return speak(current.kind === "blink" ? "eyes-blink" : "eyes-rest");
    speak("eyes-follow");
    const timers = eyeCueTimes(current).map(({ at, direction }) =>
      setTimeout(() => speak(CUE_VOICE[direction]), Math.round(at * 1000)),
    );
    return () => timers.forEach(clearTimeout);
  }, [stage, index, steps, speak]);

  if (stage === "intro") {
    return (
      <GameShell title={copy.title} onExit={onExit} scroll>
        <GameIntro
          pose="guide"
          story={copy.story}
          note={copy.note}
          start={copy.start}
          onStart={() => {
            setIndex(0);
            setStage("play");
          }}
        />
      </GameShell>
    );
  }

  if (stage === "done") {
    return (
      <GameShell title={copy.title} onExit={onExit} scroll>
        <GameCompletion
          title={copy.finished}
          message={copy.message}
          stars={1}
          starNote={starNote}
          onAgain={() => {
            setStarNote(null);
            setIndex(0);
            setStage("intro");
          }}
          onExit={onExit}
        />
      </GameShell>
    );
  }

  const title =
    step.kind === "move"
      ? `${ARROW[step.move]}  ${copy.moves[step.move]}`
      : step.kind === "blink"
        ? `🦋  ${copy.blinkTitle}`
        : `🌙  ${copy.restTitle}`;
  const hint = step.kind === "move" ? copy.follow : step.kind === "blink" ? copy.blink : copy.rest;
  return (
    <GameShell title={copy.title} onExit={onExit} colors={step.kind === "rest" ? NIGHT : DAY}>
      <StepLabel
        key={index}
        count={copy.step(index + 1, steps.length)}
        title={title}
        hint={hint}
        still={still}
      />
      <View
        style={styles.sky}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setArea({ width, height });
        }}
      >
        {area && step.kind === "move" ? (
          <>
            <Trail move={step.move} area={area} />
            <FlyingButterfly key={index} step={step} area={area} still={still} />
          </>
        ) : null}
        {step.kind === "blink" ? (
          <Blinking key={index} seconds={step.seconds} still={still} />
        ) : null}
        {step.kind === "rest" ? <Night key={index} seconds={step.seconds} still={still} /> : null}
      </View>
      <Button label={worldCopy.skip} variant="link" onPress={advance} />
    </GameShell>
  );
}

/** The step's name pops in, with how far along it is and what to do underneath. */
function StepLabel({
  count,
  title,
  hint,
  still,
}: {
  count: string;
  title: string;
  hint: string;
  still: boolean;
}) {
  const scale = useRef(new Animated.Value(still ? 1 : 0.7)).current;
  useEffect(() => {
    if (still) return;
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [scale, still]);
  return (
    <Animated.View style={[styles.label, { transform: [{ scale }] }]}>
      <Text style={styles.labelCount}>{count}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.labelTitle}>
        {title}
      </Text>
      <Text style={styles.labelHint}>{hint}</Text>
    </Animated.View>
  );
}

/** Where to the corners: the butterfly reaches the sky's edges, minus its own size. */
function reach(area: Area) {
  return {
    x: Math.max(0, area.width / 2 - BUTTERFLY / 2 - MARGIN),
    y: Math.max(0, area.height / 2 - BUTTERFLY / 2 - MARGIN),
  };
}

/** Faint dots showing the way the butterfly will fly. */
function Trail({ move, area }: { move: EyeMove; area: Area }) {
  const { x, y } = reach(area);
  const dots = Array.from({ length: 28 }, (_, i) => eyeMovePoint(move, i / 28));
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {dots.map((p, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { left: area.width / 2 + p.x * x - 4, top: area.height / 2 + p.y * y - 4 },
          ]}
        />
      ))}
    </View>
  );
}

/** The butterfly flies the move, flapping its wings; with reduced motion it hops instead. */
function FlyingButterfly({
  step,
  area,
  still,
}: {
  step: Extract<EyeStep, { kind: "move" }>;
  area: Area;
  still: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const flap = useRef(new Animated.Value(1)).current;
  const path = useMemo(
    () => eyeMovePath(step.move, step.cycles, still ? 8 : 24, still),
    [step.move, step.cycles, still],
  );
  useEffect(() => {
    // It hovers at the start while it says "Эрвээхэйг дагаарай!", then flies.
    const flight = Animated.sequence([
      Animated.delay(MOVE_LEAD_SECONDS * 1000),
      Animated.timing(progress, {
        toValue: 1,
        duration: step.seconds * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]);
    flight.start();
    const wings = still
      ? null
      : Animated.loop(
          Animated.sequence([
            Animated.timing(flap, { toValue: 0.55, duration: 180, useNativeDriver: true }),
            Animated.timing(flap, { toValue: 1, duration: 180, useNativeDriver: true }),
          ]),
        );
    wings?.start();
    return () => {
      flight.stop();
      wings?.stop();
    };
  }, [progress, flap, step.seconds, still]);
  const { x, y } = reach(area);
  const translateX = progress.interpolate({
    inputRange: path.input,
    outputRange: path.x.map((v) => v * x),
  });
  const translateY = progress.interpolate({
    inputRange: path.input,
    outputRange: path.y.map((v) => v * y),
  });
  return (
    <Animated.Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      maxFontSizeMultiplier={1}
      style={[
        styles.butterfly,
        {
          left: area.width / 2 - BUTTERFLY / 2,
          top: area.height / 2 - BUTTERFLY / 2,
          transform: [{ translateX }, { translateY }, { scaleX: flap }],
        },
      ]}
    >
      🦋
    </Animated.Text>
  );
}

/** Seconds left in a timed step, counted down once a second. */
function useCountdown(seconds: number) {
  const [left, setLeft] = useState(Math.ceil(seconds));
  useEffect(() => {
    const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  return left;
}

/** A gentle pulse for sparkles and stars; still when motion is reduced. */
function usePulse(still: boolean, duration: number) {
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 0.35, duration, useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [value, still, duration]);
  return value;
}

/** The butterfly flaps fast in the middle while the child blinks along. */
function Blinking({ seconds, still }: { seconds: number; still: boolean }) {
  const left = useCountdown(seconds);
  const flap = usePulse(still, 120);
  const sparkle = usePulse(still, 500);
  return (
    <View style={styles.center}>
      <Animated.Text style={[styles.sparkle, { opacity: sparkle }]}>✨</Animated.Text>
      <Animated.Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        maxFontSizeMultiplier={1}
        style={[styles.bigButterfly, { transform: [{ scaleX: flap }] }]}
      >
        🦋
      </Animated.Text>
      <Countdown left={left} />
    </View>
  );
}

/** A quiet night sky while the eyes rest closed; the chime at the end calls them open. */
function Night({ seconds, still }: { seconds: number; still: boolean }) {
  const left = useCountdown(seconds);
  const twinkle = usePulse(still, 1600);
  return (
    <View style={styles.center}>
      <Animated.Text style={[styles.star, styles.starLeft, { opacity: twinkle }]}>✨</Animated.Text>
      <Animated.Text style={[styles.star, styles.starRight, { opacity: twinkle }]}>
        ⭐
      </Animated.Text>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.moon}>
        🌙
      </Text>
      <Countdown left={left} />
    </View>
  );
}

function Countdown({ left }: { left: number }) {
  return (
    <View style={styles.countdown}>
      <Text style={styles.countdownText}>{copy.seconds(left)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    alignSelf: "center",
    alignItems: "center",
    gap: 2,
    backgroundColor: world.white,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 10,
    shadowColor: world.purpleDeep,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  labelCount: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
    color: world.purple,
  },
  labelTitle: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 28,
    color: world.purpleDeep,
    textAlign: "center",
  },
  labelHint: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 19,
    color: world.navy,
    textAlign: "center",
  },
  // The butterfly's sky: as much of the screen as possible, so the eyes travel far.
  sky: { flex: 1, borderRadius: 28, overflow: "hidden" },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: world.white,
    opacity: 0.7,
  },
  butterfly: {
    position: "absolute",
    width: BUTTERFLY,
    fontSize: 44,
    lineHeight: BUTTERFLY,
    textAlign: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  bigButterfly: { fontSize: 96, lineHeight: 112 },
  sparkle: { fontSize: 36 },
  moon: { fontSize: 110, lineHeight: 128 },
  star: { position: "absolute", fontSize: 28 },
  starLeft: { top: "18%", left: "16%" },
  starRight: { top: "30%", right: "14%" },
  countdown: {
    minWidth: 120,
    alignItems: "center",
    backgroundColor: world.white,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  countdownText: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 26,
    lineHeight: 32,
    color: world.purpleDeep,
  },
});
