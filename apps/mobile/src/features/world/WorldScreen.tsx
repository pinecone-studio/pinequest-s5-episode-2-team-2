import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Mascot } from "../../components/Mascot";
import type { MascotVariant } from "../../components/mascots";
import { Screen, Text } from "../../components/ui";
import { addStar, starSummary, type StarSummary } from "../../storage/play";
import { fonts } from "../../theme";
import { useActiveChildId } from "../children/useActiveChildId";
import { eyeRestCopy } from "../eyeRest/content";
import { ClinicGame } from "./ClinicGame";
import { EyeMovesGame } from "./EyeMovesGame";
import {
  clinicCopy,
  eyeMovesCopy,
  gardenCopy,
  photoCopy,
  rescueCopy,
  spaceCopy,
  styleCopy,
  worldCopy as copy,
} from "./copy";
import { GardenGame } from "./GardenGame";
import { GARDEN_STAR_PREFIX, type WorldGameKey } from "./logic";
import { PhotoGame } from "./PhotoGame";
import { RescueGame } from "./RescueGame";
import { SpaceGame } from "./SpaceGame";
import { StyleStudio } from "./StyleStudio";
import { AnimatedStar, world } from "./ui";

const DAILY_GOAL = 3;

type Card = {
  key: WorldGameKey;
  title: string;
  summary: string;
  time: string;
  ages: string;
  pose: MascotVariant;
  art: string;
  colors: readonly [string, string];
  /** "top" cards come first, above the sections. */
  section: "top" | "play" | "rest";
  source?: { label: string; url: string };
};

// Eye-health lessons keep their source (CONTRIBUTING.md); the others teach no health claim.
const AAP_SCREENS = {
  label: "AAP HealthyChildren: Avoid eye and back strain from the computer",
  url: "https://www.healthychildren.org/English/tips-tools/ask-the-pediatrician/Pages/avoid-eye-and-back-strain-from-the-computer.aspx",
};
const AAP_SIGNS = {
  label: "AAP HealthyChildren: Warning signs of vision problems in children",
  url: "https://www.healthychildren.org/English/health-issues/conditions/eyes/Pages/Warning-Signs-of-Vison-Problems-in-Children.aspx",
};
const WHO_PLAY = {
  label: "WHO: To grow up healthy, children need to sit less and play more",
  url: "https://www.who.int/news-room/detail/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more",
};

export const WORLD_CARDS: Card[] = [
  {
    key: "eyeMoves",
    ...pick(eyeMovesCopy),
    pose: "guide",
    art: "🦋👀",
    colors: ["#DCEBFF", world.lavender],
    section: "top",
    source: AAP_SCREENS,
  },
  {
    key: "rescue",
    ...pick(rescueCopy),
    pose: "thinking",
    art: "🚪✨",
    colors: [world.lavender, "#E3D6FF"],
    section: "play",
    source: AAP_SCREENS,
  },
  {
    key: "space",
    ...pick(spaceCopy),
    pose: "wave",
    art: "🚀🪐",
    colors: ["#E3D6FF", "#CFE4FF"],
    section: "play",
  },
  {
    key: "photo",
    ...pick(photoCopy),
    pose: "camera",
    art: "📸",
    colors: [world.mint, "#E9FBF5"],
    section: "play",
  },
  {
    key: "clinic",
    ...pick(clinicCopy),
    pose: "guide",
    art: "🐰🦊",
    colors: [world.peach, "#FFF3E4"],
    section: "play",
    source: AAP_SIGNS,
  },
  {
    key: "style",
    ...pick(styleCopy),
    pose: "idle_happy",
    art: "👑🎒",
    colors: ["#FFE3EE", world.cream],
    section: "play",
  },
  {
    key: "garden",
    ...pick(gardenCopy),
    pose: "idle_happy",
    art: "🌷🌳",
    colors: [world.mint, world.cream],
    section: "rest",
    source: WHO_PLAY,
  },
];

function pick(source: { title: string; summary: string; time: string; ages: string }) {
  return { title: source.title, summary: source.summary, time: source.time, ages: source.ages };
}

/**
 * The Тоглоом tab: Нүдхэний ертөнц. Learning games and screen-free breaks around our mascot.
 * A game earns one star a day for playing it; nothing here checks or scores eyes.
 */
export default function WorldScreen() {
  const db = useSQLiteContext();
  const childId = useActiveChildId() ?? null;
  const [stars, setStars] = useState<StarSummary | null>(null);
  const [open, setOpen] = useState<WorldGameKey | null>(null);

  const reload = useCallback(async () => {
    if (!childId) return setStars(null);
    setStars(await starSummary(db, childId));
  }, [db, childId]);
  useEffect(() => {
    void reload().catch(() => setStars(null));
  }, [reload]);

  /** The day's star for a game: true when new, false when already earned (or no child). */
  const award = useCallback(
    async (game: string) => {
      if (!childId) return false;
      const added = await addStar(db, childId, game);
      await reload().catch(() => undefined);
      return added;
    },
    [db, childId, reload],
  );
  const complete = useCallback(
    (game: WorldGameKey) => async () => {
      if (!childId) return copy.noChild;
      const added = await award(game).catch(() => false);
      return added ? copy.starEarned : copy.starAlready;
    },
    [award, childId],
  );
  const exit = () => setOpen(null);
  // Garden breaks earn `garden-<break>` stars; every other game earns its own key.
  const doneToday = (card: Card) =>
    (card.key === "garden"
      ? stars?.today.some((g) => g.startsWith(GARDEN_STAR_PREFIX))
      : stars?.today.includes(card.key)) ?? false;
  const cards = (section: Card["section"]) =>
    WORLD_CARDS.filter((c) => c.section === section).map((card) => (
      <GameCard
        key={card.key}
        card={card}
        done={doneToday(card)}
        onStart={() => setOpen(card.key)}
      />
    ));

  switch (open) {
    case "rescue":
      return <RescueGame onComplete={complete("rescue")} onExit={exit} />;
    case "space":
      return <SpaceGame onComplete={complete("space")} onExit={exit} />;
    case "photo":
      return <PhotoGame onComplete={complete("photo")} onExit={exit} />;
    case "clinic":
      return <ClinicGame onComplete={complete("clinic")} onExit={exit} />;
    case "garden":
      return <GardenGame childId={childId} award={award} onExit={exit} />;
    case "style":
      return <StyleStudio childId={childId} totalStars={stars?.total ?? 0} onExit={exit} />;
    case "eyeMoves":
      return <EyeMovesGame onComplete={complete("eyeMoves")} onExit={exit} />;
  }

  const today = Math.min(stars?.today.length ?? 0, DAILY_GOAL);
  return (
    <Screen>
      <LinearGradient colors={["#CDBDF7", world.lavender, world.mint]} style={styles.hero}>
        <Text style={[styles.deco, { top: 10, right: 40 }]}>☁️</Text>
        <Text style={[styles.deco, { top: 54, right: 120, fontSize: 16 }]}>✨</Text>
        <Text style={[styles.deco, { bottom: 16, left: 150, fontSize: 18 }]}>⭐</Text>
        <View style={styles.heroText}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>
            {copy.title}
          </Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
          {stars ? (
            <View style={styles.total} accessible accessibilityLabel={copy.totalStars(stars.total)}>
              <Ionicons name="star" size={16} color={world.gold} />
              <Text style={styles.totalText}>{copy.totalStars(stars.total)}</Text>
            </View>
          ) : null}
        </View>
        <Mascot variant="idle_happy" size={130} maxScreenShare={0.36} motion="float" />
      </LinearGradient>

      <View style={styles.daily}>
        <View style={styles.flex}>
          <Text style={styles.dailyTitle}>{copy.todayStars}</Text>
          <Text style={styles.muted}>
            {childId ? copy.todayProgress(today, DAILY_GOAL) : copy.noChild}
          </Text>
        </View>
        <View
          style={styles.dailyStars}
          accessible
          accessibilityLabel={`${copy.todayStars}: ${copy.todayProgress(today, DAILY_GOAL)}`}
        >
          {Array.from({ length: DAILY_GOAL }, (_, i) => (
            <AnimatedStar key={i} lit={i < today} size={30} />
          ))}
        </View>
      </View>

      {cards("top")}
      <Section title={copy.playSection} hint={copy.playSectionHint} />
      {cards("play")}
      <Section title={copy.restSection} hint={copy.restSectionHint} />
      {cards("rest")}

      <View style={styles.notes}>
        <Text variant="caption" style={styles.muted}>
          {copy.gamesNote}
        </Text>
        <Text variant="caption" style={styles.muted}>
          {eyeRestCopy.notice}
        </Text>
      </View>
    </Screen>
  );
}

function Section({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <Text variant="caption" style={styles.muted}>
        {hint}
      </Text>
    </View>
  );
}

/** A large illustrated card: art, title, one line, time, age, a start button and its source. */
export function GameCard({
  card,
  done,
  onStart,
}: {
  card: Card;
  done: boolean;
  onStart: () => void;
}) {
  const source = card.source;
  return (
    <View style={styles.cardWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${card.title}. ${card.summary}. ${card.time}, ${card.ages}`}
        accessibilityHint={copy.play}
        onPress={onStart}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <LinearGradient
          colors={card.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardSummary}>{card.summary}</Text>
            <View style={styles.chips}>
              <Text variant="caption" style={styles.chip}>
                ⏱ {card.time}
              </Text>
              <Text variant="caption" style={styles.chip}>
                {card.ages}
              </Text>
            </View>
            <View style={styles.start}>
              <Ionicons name={done ? "star" : "play"} size={16} color={world.white} />
              <Text style={styles.startText}>{done ? `${copy.play} ✓` : copy.play}</Text>
            </View>
          </View>
          <View
            style={styles.art}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text maxFontSizeMultiplier={1} style={styles.artEmoji}>
              {card.art}
            </Text>
            <Mascot variant={card.pose} size={96} maxScreenShare={0.26} />
          </View>
        </LinearGradient>
      </Pressable>
      {source ? (
        <Pressable
          accessibilityRole="link"
          accessibilityHint={source.url}
          onPress={() => void Linking.openURL(source.url)}
          style={styles.source}
        >
          <Text variant="caption" style={styles.sourceText}>
            {copy.sourcePrefix} {source.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 32,
    padding: 20,
    gap: 8,
    overflow: "hidden",
  },
  deco: { position: "absolute", fontSize: 24 },
  heroText: { flex: 1, gap: 6 },
  title: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 34,
    color: world.purpleDeep,
  },
  subtitle: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
    color: world.navy,
  },
  total: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: world.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  totalText: { fontFamily: fonts.extraBold, fontWeight: "800", fontSize: 14, color: world.navy },
  daily: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: world.white,
    borderRadius: 24,
    padding: 16,
    shadowColor: world.purpleDeep,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  dailyTitle: { fontFamily: fonts.black, fontWeight: "900", fontSize: 17, color: world.navy },
  dailyStars: { flexDirection: "row", gap: 4 },
  muted: { color: "#5D5A7A" },
  section: { marginTop: 8, gap: 2 },
  sectionTitle: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 22,
    color: world.purpleDeep,
  },
  cardWrap: { gap: 2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    padding: 16,
    gap: 8,
    minHeight: 150,
    shadowColor: world.purpleDeep,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  cardText: { flex: 1, gap: 6 },
  cardTitle: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 19,
    lineHeight: 24,
    color: world.navy,
  },
  cardSummary: { fontSize: 14, lineHeight: 19, color: "#4C4A6A" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    color: world.navy,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: "hidden",
  },
  start: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: world.purple,
    marginTop: 4,
  },
  startText: { fontFamily: fonts.extraBold, fontWeight: "800", fontSize: 15, color: world.white },
  art: { alignItems: "center", width: 104 },
  artEmoji: { fontSize: 26, lineHeight: 32 },
  source: { minHeight: 32, justifyContent: "center", paddingHorizontal: 8 },
  sourceText: { color: "#5D5A7A", textDecorationLine: "underline", fontWeight: "500" },
  notes: { gap: 8, marginTop: 8 },
});
