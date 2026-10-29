import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useReduceMotion } from "../../components/useReduceMotion";
import { spaceCopy as copy } from "./copy";
import { E_ROTATION, SPACE_ROUNDS, spaceRounds, type Direction } from "./logic";
import { GameCompletion, GameIntro, GameShell, SpeechBubble, useSuccessSound, world } from "./ui";

const PLANETS = ["#FFC9B0", "#B5E9D8", "#FFE08A", "#C9B8FF", "#9FD8F2"];
const ARROW: Record<Direction, keyof typeof Ionicons.glyphMap> = {
  up: "arrow-up",
  down: "arrow-down",
  left: "arrow-back",
  right: "arrow-forward",
};

/**
 * Э үсгийн сансрын аялал: practise pointing to the open side of a playful E. This is only a
 * familiarisation game. It is drawn differently from the real test, uses its own code, keeps no
 * score and never touches the vision check or its results.
 */
export function SpaceGame({
  onComplete,
  onExit,
}: {
  onComplete: () => Promise<string | null>;
  onExit: () => void;
}) {
  // A new set of directions for every run.
  const [rounds, setRounds] = useState(() => spaceRounds(SPACE_ROUNDS));
  const [stage, setStage] = useState<"intro" | "play" | "done">("intro");
  const [index, setIndex] = useState(0);
  const [missed, setMissed] = useState<Direction | null>(null);
  const [starNote, setStarNote] = useState<string | null>(null);
  const success = useSuccessSound();
  const reduceMotion = useReduceMotion();
  const flight = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  const direction = rounds[index]!;
  const answer = (choice: Direction) => {
    if (busy.current) return;
    if (choice !== direction) {
      setMissed(direction);
      return;
    }
    busy.current = true;
    setMissed(null);
    success();
    const next = () => {
      flight.setValue(0);
      busy.current = false;
      if (index + 1 >= rounds.length) {
        setStage("done");
        void onComplete().then(setStarNote, () => setStarNote(null));
      } else setIndex(index + 1);
    };
    if (reduceMotion) return void setTimeout(next, 500);
    Animated.timing(flight, {
      toValue: 1,
      duration: 1100,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(next);
  };

  const restart = () => {
    setRounds(spaceRounds(SPACE_ROUNDS));
    setIndex(0);
    setMissed(null);
    setStage("play");
  };

  return (
    <GameShell
      title={copy.title}
      onExit={onExit}
      progress={
        stage === "intro"
          ? undefined
          : { done: stage === "done" ? rounds.length : index, total: rounds.length }
      }
      colors={["#C9B8FF", world.lavender, world.cream]}
    >
      {stage === "intro" ? (
        <GameIntro
          pose="wave"
          story={copy.intro}
          note={copy.note}
          start={copy.start}
          onStart={() => setStage("play")}
        />
      ) : stage === "done" ? (
        <GameCompletion
          title={copy.finished}
          message={copy.lesson}
          stars={rounds.length}
          starNote={starNote}
          onAgain={restart}
          onExit={onExit}
        />
      ) : (
        <View style={styles.play}>
          <SpeechBubble
            pose={missed ? "thinking" : "idle_happy"}
            text={missed ? copy.explain(copy.directions[missed]) : copy.task}
            tone={missed ? "peach" : "white"}
            size={72}
          />
          <View style={styles.sky}>
            {[
              { t: 14, l: 20 },
              { t: 40, l: 260 },
              { t: 120, l: 40 },
              { t: 22, l: 170 },
            ].map((s, i) => (
              <Ionicons
                key={i}
                name="sparkles"
                size={14}
                color="#FFFFFF"
                style={[styles.abs, { top: s.t, left: s.l }]}
              />
            ))}
            {/* The next planet waits at the top; the rocket glides up to it on a right answer. */}
            <View style={[styles.planet, { backgroundColor: PLANETS[index % PLANETS.length] }]}>
              <View style={styles.ring} />
            </View>
            <Animated.Text
              style={[
                styles.rocket,
                {
                  transform: [
                    {
                      translateY: flight.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -120],
                      }),
                    },
                    { scale: flight.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) },
                  ],
                },
              ]}
            >
              🚀
            </Animated.Text>
            <View style={styles.eCard} accessible accessibilityLabel={copy.task}>
              <PlayfulE direction={direction} />
            </View>
          </View>
          <Pad onAnswer={answer} highlight={missed} />
        </View>
      )}
    </GameShell>
  );
}

/** A rounded, colourful E: clearly a toy, not the clinical chart letter. */
function PlayfulE({ direction }: { direction: Direction }) {
  return (
    <View testID="playful-e" style={[styles.e, { transform: [{ rotate: E_ROTATION[direction] }] }]}>
      <View style={styles.eSpine} />
      <View style={[styles.eBar, { top: 0, backgroundColor: "#8E79DF" }]} />
      <View style={[styles.eBar, { top: 32, backgroundColor: "#5FC4A6" }]} />
      <View style={[styles.eBar, { top: 64, backgroundColor: "#F2A48C" }]} />
    </View>
  );
}

function Pad({
  onAnswer,
  highlight,
}: {
  onAnswer: (d: Direction) => void;
  highlight: Direction | null;
}) {
  const button = (direction: Direction) => (
    <Pressable
      key={direction}
      accessibilityRole="button"
      accessibilityLabel={copy.directions[direction]}
      onPress={() => onAnswer(direction)}
      style={({ pressed }) => [
        styles.arrow,
        highlight === direction && styles.arrowHint,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={ARROW[direction]}
        size={34}
        color={highlight === direction ? world.white : world.purpleDeep}
      />
    </Pressable>
  );
  return (
    <View style={styles.pad}>
      {button("up")}
      <View style={styles.padRow}>
        {button("left")}
        {button("right")}
      </View>
      {button("down")}
    </View>
  );
}

const styles = StyleSheet.create({
  play: { flex: 1, gap: 12 },
  sky: {
    flex: 1,
    minHeight: 170,
    borderRadius: 32,
    backgroundColor: "#6E5BC9",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 14,
    overflow: "hidden",
  },
  abs: { position: "absolute" },
  planet: {
    position: "absolute",
    top: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: 96,
    height: 18,
    borderRadius: 9,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.7)",
    transform: [{ rotate: "-14deg" }],
  },
  rocket: {
    position: "absolute",
    left: 24,
    bottom: 24,
    fontSize: 42,
    transform: [{ rotate: "-45deg" }],
  },
  eCard: {
    width: 124,
    height: 124,
    borderRadius: 32,
    backgroundColor: world.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  e: { width: 84, height: 84 },
  eSpine: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 22,
    height: 84,
    borderRadius: 11,
    backgroundColor: world.navy,
  },
  eBar: { position: "absolute", left: 0, width: 84, height: 20, borderRadius: 10 },
  pad: { alignItems: "center", gap: 4 },
  padRow: { flexDirection: "row", gap: 76 },
  arrow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: world.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: world.purpleDeep,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  arrowHint: { backgroundColor: world.purple },
  pressed: { transform: [{ scale: 0.95 }] },
});
