import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../components/ui";
import { fonts } from "../../theme";
import { clinicCopy as copy, worldCopy } from "./copy";
import { CLINIC_CASES } from "./logic";
import {
  ChoiceCard,
  GameCompletion,
  GameIntro,
  GameShell,
  SpeechBubble,
  useSuccessSound,
  world,
} from "./ui";

/**
 * Бяцхан нүдний эмч: cartoon animals share everyday worries and the child, as Нүдхэн's helper,
 * picks the sensible next step. The lesson is always "tell a trusted adult", "take a break" or
 * "follow the doctor"; the child never diagnoses anything.
 */
export function ClinicGame({
  onComplete,
  onExit,
}: {
  onComplete: () => Promise<string | null>;
  onExit: () => void;
}) {
  const [stage, setStage] = useState<"intro" | "play" | "done">("intro");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [starNote, setStarNote] = useState<string | null>(null);
  const success = useSuccessSound();

  const patient = CLINIC_CASES[index]!;
  const choice = picked === null ? null : patient.choices[picked]!;
  const solved = choice?.good ?? false;

  const choose = (i: number) => {
    if (solved) return;
    setPicked(i);
    if (patient.choices[i]!.good) success();
  };
  const next = () => {
    setPicked(null);
    if (index + 1 >= CLINIC_CASES.length) {
      setStage("done");
      void onComplete().then(setStarNote, () => setStarNote(null));
    } else setIndex(index + 1);
  };

  return (
    <GameShell
      title={copy.title}
      onExit={onExit}
      progress={
        stage === "intro"
          ? undefined
          : { done: stage === "done" ? CLINIC_CASES.length : index, total: CLINIC_CASES.length }
      }
      colors={[world.lavender, world.mint]}
      scroll
    >
      {stage === "intro" ? (
        <GameIntro
          pose="guide"
          story={copy.intro}
          note={copy.note}
          start={copy.start}
          onStart={() => setStage("play")}
        />
      ) : stage === "done" ? (
        <GameCompletion
          title={copy.finished}
          badge={copy.badge}
          stars={CLINIC_CASES.length}
          starNote={starNote}
          onAgain={() => {
            setIndex(0);
            setPicked(null);
            setStage("play");
          }}
          onExit={onExit}
        />
      ) : (
        <>
          {/* The patient's chair: a cute animal and what it says. */}
          <View style={styles.patient}>
            <View style={styles.chair}>
              <Text maxFontSizeMultiplier={1} style={styles.animal}>
                {patient.emoji}
              </Text>
            </View>
            <View style={styles.says}>
              <Text style={styles.name}>{patient.name}</Text>
              <Text style={styles.quote}>“{patient.says}”</Text>
            </View>
          </View>
          <SpeechBubble
            pose={solved ? "celebrate" : choice ? "thinking" : "guide"}
            text={solved ? copy.good : (choice?.why ?? patient.ask)}
            tone={solved ? "mint" : choice ? "peach" : "white"}
            size={76}
          />
          <View style={styles.choices}>
            {patient.choices.map((option, i) => (
              <ChoiceCard
                key={option.label}
                emoji={option.emoji}
                label={option.label}
                state={picked === i ? (option.good ? "right" : "wrong") : "idle"}
                onPress={() => choose(i)}
              />
            ))}
          </View>
          {solved ? <ChoiceCard emoji="➡️" label={worldCopy.next} onPress={next} /> : null}
        </>
      )}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  patient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: world.white,
    borderRadius: 28,
    padding: 16,
  },
  chair: {
    width: 92,
    height: 92,
    borderRadius: 30,
    backgroundColor: world.peach,
    alignItems: "center",
    justifyContent: "center",
  },
  animal: { fontSize: 56, lineHeight: 64 },
  says: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.black, fontWeight: "900", fontSize: 17, color: world.purpleDeep },
  quote: {
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 25,
    color: world.navy,
  },
  choices: { flexDirection: "row", gap: 8 },
});
