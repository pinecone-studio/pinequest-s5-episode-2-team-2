import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { MascotVariant } from "../../components/mascots";
import { Text } from "../../components/ui";
import { photoCopy as copy, worldCopy } from "./copy";
import { PHOTO_ROUNDS, type Face } from "./logic";
import {
  ChoiceCard,
  GameCompletion,
  GameIntro,
  GameShell,
  SpeechBubble,
  useSuccessSound,
  world,
} from "./ui";

// Нүдхэн gets happier with every good photo.
const MOODS: MascotVariant[] = ["thinking", "idle_happy", "wave", "celebrate"];

/**
 * Зургийн мастер: pick the drawn photo that follows the app's approved capture preparation.
 * No camera and no real photos: every face is drawn here. It teaches, it never screens.
 */
export function PhotoGame({
  onComplete,
  onExit,
}: {
  onComplete: () => Promise<string | null>;
  onExit: () => void;
}) {
  const [stage, setStage] = useState<"intro" | "play" | "done">("intro");
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [starNote, setStarNote] = useState<string | null>(null);
  const success = useSuccessSound();

  const options = PHOTO_ROUNDS[round]!;
  const right = picked !== null && options[picked]!.good;
  const choose = (index: number) => {
    if (right) return;
    setPicked(index);
    if (options[index]!.good) success();
  };
  const next = () => {
    setPicked(null);
    if (round + 1 >= PHOTO_ROUNDS.length) {
      setStage("done");
      void onComplete().then(setStarNote, () => setStarNote(null));
    } else setRound(round + 1);
  };

  const feedback = picked === null ? copy.task : right ? copy.good : options[picked]!.label;

  return (
    <GameShell
      title={copy.title}
      onExit={onExit}
      progress={
        stage === "intro"
          ? undefined
          : { done: stage === "done" ? PHOTO_ROUNDS.length : round, total: PHOTO_ROUNDS.length }
      }
      colors={[world.lavender, world.cream]}
    >
      {stage === "intro" ? (
        <GameIntro
          pose="camera"
          story={copy.intro}
          note={copy.note}
          start={copy.start}
          onStart={() => setStage("play")}
        />
      ) : stage === "done" ? (
        <GameCompletion
          title={copy.finished}
          stars={PHOTO_ROUNDS.length}
          starNote={starNote}
          onAgain={() => {
            setRound(0);
            setPicked(null);
            setStage("play");
          }}
          onExit={onExit}
        />
      ) : (
        <View style={styles.play}>
          <SpeechBubble
            pose={MOODS[Math.min(round + (right ? 1 : 0), MOODS.length - 1)]!}
            text={feedback}
            tone={picked === null ? "white" : right ? "mint" : "peach"}
            size={80}
          />
          <View
            style={styles.studio}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text maxFontSizeMultiplier={1} style={styles.studioArt}>
              💡 📷 🖼️
            </Text>
          </View>
          <View style={styles.row}>
            {options.map((option, index) => (
              <ChoiceCard
                key={index}
                label={picked === index ? option.label : `${index + 1}`}
                state={
                  picked === index
                    ? option.good
                      ? "right"
                      : "wrong"
                    : right && option.good
                      ? "right"
                      : "idle"
                }
                onPress={() => choose(index)}
              >
                <Photo face={option.face} />
              </ChoiceCard>
            ))}
          </View>
          {right ? (
            <ChoiceCard
              emoji="➡️"
              label={round + 1 >= PHOTO_ROUNDS.length ? copy.finished : worldCopy.next}
              onPress={next}
            />
          ) : null}
        </View>
      )}
    </GameShell>
  );
}

/** A tiny drawn photo of a child's face; the mistakes are drawn in, never photographed. */
export function Photo({ face }: { face: Face }) {
  const zoom = (face.distance === "close" ? 1.8 : face.distance === "far" ? 0.45 : 1) * 1.2;
  const layers = face.blurry ? [-3, 0, 3] : [0];
  return (
    <View style={styles.frame} accessible={false}>
      <View style={styles.photo}>
        {layers.map((shift) => (
          <View
            key={shift}
            style={[
              styles.faceWrap,
              {
                opacity: face.blurry ? 0.4 : 1,
                transform: [{ translateX: shift }, { translateY: -shift / 2 }, { scale: zoom }],
              },
            ]}
          >
            <DrawnFace face={face} />
          </View>
        ))}
      </View>
    </View>
  );
}

function DrawnFace({ face }: { face: Face }) {
  const pupilShift = face.look === "away" ? 5 : 0;
  const eye = (key: string, small = false) =>
    face.eyes === "closed" ? (
      <View key={key} style={[styles.closedEye, small && styles.small]} />
    ) : (
      <View key={key} style={[styles.eye, small && styles.small]}>
        <View style={[styles.pupil, { transform: [{ translateX: pupilShift }] }]} />
      </View>
    );
  return (
    <View style={[styles.head, face.turned && { transform: [{ scaleX: 0.82 }] }]}>
      <View style={styles.hair} />
      <View style={[styles.eyes, face.turned && { transform: [{ translateX: 10 }], gap: 6 }]}>
        {eye("l", face.turned)}
        {eye("r")}
      </View>
      <View style={[styles.cheeks, face.turned && { transform: [{ translateX: 10 }] }]}>
        <View style={styles.cheek} />
        <View style={styles.cheek} />
      </View>
      <View style={[styles.smile, face.turned && { transform: [{ translateX: 10 }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  play: { flex: 1, gap: 14 },
  row: { flexDirection: "row", gap: 8 },
  studio: {
    borderRadius: 28,
    backgroundColor: world.mint,
    paddingVertical: 14,
    alignItems: "center",
  },
  studioArt: { fontSize: 34, letterSpacing: 10 },
  frame: {
    width: 96,
    height: 116,
    borderRadius: 14,
    backgroundColor: world.cream,
    padding: 5,
    borderWidth: 2,
    borderColor: "#EADFCB",
  },
  photo: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#DCEBFF",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  faceWrap: { position: "absolute" },
  head: {
    width: 58,
    height: 62,
    borderRadius: 29,
    backgroundColor: "#FFDCC2",
    alignItems: "center",
    overflow: "hidden",
  },
  hair: {
    width: 64,
    height: 22,
    backgroundColor: "#6B4A3A",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  eyes: { flexDirection: "row", gap: 12, marginTop: 6 },
  eye: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  small: { width: 8 },
  pupil: { width: 7, height: 7, borderRadius: 4, backgroundColor: world.navy },
  closedEye: {
    width: 13,
    height: 6,
    borderBottomWidth: 2.5,
    borderColor: world.navy,
    borderRadius: 6,
  },
  cheeks: { flexDirection: "row", gap: 22, marginTop: 2 },
  cheek: { width: 8, height: 5, borderRadius: 3, backgroundColor: "#F9B4B4" },
  smile: {
    width: 16,
    height: 8,
    borderBottomWidth: 2.5,
    borderColor: "#C86B6B",
    borderRadius: 8,
    marginTop: 1,
  },
});
