import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import chime from "../../../assets/sounds/correct.wav";
import { Mascot } from "../../components/Mascot";
import type { MascotVariant } from "../../components/mascots";
import { Button, Text } from "../../components/ui";
import { useReduceMotion } from "../../components/useReduceMotion";
import { fonts } from "../../theme";
import { worldCopy } from "./copy";

/** The Нүдхэний ертөнц palette: dreamy purple, mint, peach and cream. */
export const world = {
  purple: "#8E79DF",
  purpleDeep: "#5B47B8",
  lavender: "#F0E7FF",
  mint: "#CBF2E7",
  mintDeep: "#2E8C74",
  peach: "#FFE6CA",
  peachDeep: "#B8693A",
  cream: "#FFFAF2",
  navy: "#283354",
  white: "#FFFFFF",
  gold: "#F5B82E",
} as const;

/** A short chime for a right answer. Sound is a bonus: a failure never stops the game. */
export function useSuccessSound() {
  const player = useAudioPlayer(chime);
  return useCallback(() => {
    try {
      void player.seekTo(0);
      player.play();
    } catch {
      // The visual feedback is enough.
    }
  }, [player]);
}

/**
 * Full-screen frame for one game: a soft gradient, a big close button, the title and the
 * child's progress as stars. Content does not scroll by default, so dragging works.
 */
export function GameShell({
  title,
  onExit,
  progress,
  colors = [world.lavender, world.cream],
  scroll = false,
  children,
}: {
  title: string;
  onExit: () => void;
  progress?: { done: number; total: number } | undefined;
  colors?: readonly [string, string, ...string[]];
  scroll?: boolean;
  children: ReactNode;
}) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollBody}>{children}</ScrollView>
  ) : (
    <View style={styles.body}>{children}</View>
  );
  return (
    <LinearGradient colors={colors} style={styles.fill}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.fill}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={worldCopy.exit}
            onPress={onExit}
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={28} color={world.navy} />
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {progress ? <StarRow done={progress.done} total={progress.total} /> : null}
        </View>
        {body}
      </SafeAreaView>
    </LinearGradient>
  );
}

/** Progress as stars that pop gently when earned. */
export function StarRow({
  done,
  total,
  size = 22,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  return (
    <View
      style={styles.stars}
      accessible
      accessibilityLabel={worldCopy.level(Math.min(done, total), total)}
    >
      {Array.from({ length: total }, (_, i) => (
        <AnimatedStar key={i} lit={i < done} size={size} />
      ))}
    </View>
  );
}

export function AnimatedStar({ lit, size = 22 }: { lit: boolean; size?: number }) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const wasLit = useRef(lit);
  useEffect(() => {
    if (lit && !wasLit.current && !reduceMotion) {
      scale.setValue(0.4);
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
    wasLit.current = lit;
  }, [lit, reduceMotion, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons
        name={lit ? "star" : "star-outline"}
        size={size}
        color={lit ? world.gold : "#A99BE0"}
      />
    </Animated.View>
  );
}

/** Нүдхэн says something in a rounded speech bubble. */
export function SpeechBubble({
  pose = "idle_happy",
  text,
  size = 96,
  tone = "white",
}: {
  pose?: MascotVariant;
  text: string;
  size?: number;
  tone?: "white" | "mint" | "peach";
}) {
  const background = tone === "mint" ? world.mint : tone === "peach" ? world.peach : world.white;
  return (
    <View style={styles.speech}>
      <Mascot variant={pose} size={size} maxScreenShare={0.3} />
      <View style={[styles.bubble, { backgroundColor: background }]}>
        <Text accessibilityLiveRegion="polite" style={styles.bubbleText}>
          {text}
        </Text>
      </View>
    </View>
  );
}

/** A large tappable answer card with a picture. Wrong answers are marked softly, never punished. */
export function ChoiceCard({
  emoji,
  label,
  state = "idle",
  onPress,
  children,
}: {
  emoji?: string;
  label: string;
  state?: "idle" | "right" | "wrong";
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: state === "right" }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        state === "right" && styles.choiceRight,
        state === "wrong" && styles.choiceWrong,
        pressed && styles.pressed,
      ]}
    >
      {children ?? (
        <Text maxFontSizeMultiplier={1} style={styles.choiceEmoji}>
          {emoji}
        </Text>
      )}
      <Text style={styles.choiceLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * The story screen before a game: Нүдхэн, the story, an honest note, any choices (`children`)
 * and a big start button.
 */
export function GameIntro({
  pose,
  story,
  note,
  start,
  onStart,
  picture,
  children,
}: {
  pose: MascotVariant;
  story: string;
  note?: string;
  start: string;
  onStart: () => void;
  picture?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={styles.intro}>
      {picture}
      <Mascot variant={pose} size={180} motion="pop" halo={world.white} />
      <Text style={styles.story}>{story}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {children}
      <View style={styles.wide}>
        <Button label={start} onPress={onStart} />
      </View>
    </View>
  );
}

/**
 * The happy ending: Нүдхэн celebrates taking part. The star is for playing, never for eyes.
 */
export function GameCompletion({
  title,
  message,
  stars,
  starNote,
  onAgain,
  onExit,
  badge,
}: {
  title: string;
  message?: string;
  stars: number;
  starNote?: string | null;
  onAgain?: () => void;
  onExit: () => void;
  badge?: string;
}) {
  return (
    <View style={styles.intro}>
      <StarRow done={stars} total={stars} size={34} />
      <Mascot variant="celebrate" size={200} motion="pop" halo={world.mint} />
      {badge ? <Text style={styles.badge}>🏅 {badge}</Text> : null}
      <Text accessibilityRole="header" style={styles.finished}>
        {title}
      </Text>
      {message ? <Text style={styles.story}>{message}</Text> : null}
      {starNote ? (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {starNote}
        </Text>
      ) : null}
      <View style={styles.wide}>
        {onAgain ? <Button label={worldCopy.again} variant="secondary" onPress={onAgain} /> : null}
        <Button label={worldCopy.backToWorld} onPress={onExit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: world.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: world.purpleDeep,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  title: {
    flex: 1,
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 21,
    color: world.navy,
  },
  stars: { flexDirection: "row", gap: 4 },
  body: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  scrollBody: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  speech: { flexDirection: "row", alignItems: "center", gap: 8 },
  bubble: {
    flex: 1,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: world.purpleDeep,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  bubbleText: {
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 17,
    lineHeight: 23,
    color: world.navy,
  },
  choice: {
    flex: 1,
    minHeight: 120,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "transparent",
    backgroundColor: world.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 6,
    shadowColor: world.purpleDeep,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  choiceRight: { borderColor: world.mintDeep, backgroundColor: world.mint },
  choiceWrong: { borderColor: "#F2B48D", backgroundColor: world.peach },
  choiceEmoji: { fontSize: 44, lineHeight: 52 },
  choiceLabel: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 19,
    color: world.navy,
    textAlign: "center",
  },
  intro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 12 },
  story: {
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 27,
    color: world.navy,
    textAlign: "center",
  },
  note: { fontSize: 14, lineHeight: 20, color: "#5D5A7A", textAlign: "center" },
  wide: { alignSelf: "stretch", gap: 10 },
  finished: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 34,
    color: world.purpleDeep,
    textAlign: "center",
  },
  badge: {
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 16,
    color: world.peachDeep,
    backgroundColor: world.peach,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: "hidden",
  },
});
