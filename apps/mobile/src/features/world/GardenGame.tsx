import { LinearGradient } from "expo-linear-gradient";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { Mascot } from "../../components/Mascot";
import { mascotSources } from "../../components/mascots";
import { Button, Text } from "../../components/ui";
import { useReduceMotion } from "../../components/useReduceMotion";
import { countStars, loadPlayState, savePlayState } from "../../storage/playState";
import { fonts } from "../../theme";
import { gardenCopy as copy } from "./copy";
import {
  EMPTY_GARDEN,
  GARDEN_BREAKS,
  GARDEN_STAR_PREFIX,
  PLANTS,
  canConfirmBreak,
  cleanGarden,
  plant,
  plantedCount,
  seedsLeft,
  unlockedPlants,
  type GardenBreak,
  type GardenState,
  type PlantId,
} from "./logic";
import { ChoiceCard, GameShell, SpeechBubble, world } from "./ui";

type Stage = "garden" | "choose" | "ready" | "away";
const GARDEN_KEY = "garden";

/**
 * Нүдхэний шидэт цэцэрлэг: real breaks away from the screen earn seeds; seeds grow a pastel
 * garden. The app cannot see the break, so the child or a parent confirms it, and only after a
 * sensible minimum. Each break gives one seed a day and the garden has twelve plots, so there is
 * nothing to farm and no reason to hurry back.
 */
export function GardenGame({
  childId,
  award,
  onExit,
}: {
  childId: string | null;
  /** Adds the day's star for a break: true if new, false if already earned today. */
  award: (game: string) => Promise<boolean>;
  onExit: () => void;
}) {
  const db = useSQLiteContext();
  const [stage, setStage] = useState<Stage>("garden");
  const [garden, setGarden] = useState<GardenState>(EMPTY_GARDEN);
  const [earned, setEarned] = useState(0);
  // A one-off line (a new seed, already earned today) shown until the child does something.
  const [note, setNote] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<number | null>(null);
  const [activity, setActivity] = useState<GardenBreak | null>(null);
  const [grown, setGrown] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!childId) return;
    const [saved, count] = await Promise.all([
      loadPlayState(db, childId, GARDEN_KEY, EMPTY_GARDEN),
      countStars(db, childId, GARDEN_STAR_PREFIX),
    ]);
    setGarden(cleanGarden(saved));
    setEarned(count);
  }, [db, childId]);
  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  const seeds = seedsLeft(earned, garden);
  const full = plantedCount(garden) >= garden.plots.length;
  const hint = !childId ? copy.noChild : full ? copy.full : seeds > 0 ? copy.tapPlot : copy.noSeeds;
  const message = note ?? hint;

  const plantHere = async (id: PlantId) => {
    if (choosing === null || !childId) return;
    const next = plant(garden, choosing, id, earned);
    setChoosing(null);
    if (next === garden) return;
    setGarden(next);
    setGrown(choosing);
    await savePlayState(db, childId, GARDEN_KEY, next).catch(() => undefined);
  };

  const finishBreak = async () => {
    if (!activity) return;
    setStage("garden");
    if (!childId) return setNote(copy.noChild);
    const added = await award(`${GARDEN_STAR_PREFIX}${activity.id}`).catch(() => false);
    await reload().catch(() => undefined);
    setNote(added ? copy.seedEarned : copy.alreadyToday);
  };

  if (stage === "choose") {
    return (
      <GameShell
        title={copy.title}
        onExit={() => setStage("garden")}
        colors={[world.mint, world.cream]}
        scroll
      >
        <SpeechBubble pose="wave" text={copy.chooseBreak} />
        <View style={styles.grid2}>
          {GARDEN_BREAKS.map((item) => (
            <View key={item.id} style={styles.half}>
              <ChoiceCard
                emoji={item.emoji}
                label={`${copy.breaks[item.id]} · ${item.minutes}`}
                onPress={() => {
                  setActivity(item);
                  setStage("ready");
                }}
              />
            </View>
          ))}
        </View>
      </GameShell>
    );
  }

  if ((stage === "ready" || stage === "away") && activity) {
    return (
      <GameShell
        title={copy.breaks[activity.id]}
        onExit={() => setStage("garden")}
        colors={[world.mint, world.cream]}
      >
        <Away
          activity={activity}
          away={stage === "away"}
          onGo={() => setStage("away")}
          onConfirm={() => void finishBreak()}
          onCancel={() => setStage("garden")}
        />
      </GameShell>
    );
  }

  const picker = choosing !== null;
  return (
    <GameShell title={copy.title} onExit={onExit} colors={[world.mint, world.cream]} scroll>
      <View style={styles.top}>
        <Text style={styles.seeds} accessibilityLiveRegion="polite">
          🌰 {copy.seeds(seeds)}
        </Text>
      </View>
      <LinearGradient colors={["#DCEBFF", world.lavender, world.mint]} style={styles.board}>
        <Text style={[styles.cloud, { left: 16 }]}>☁️</Text>
        <Text style={[styles.cloud, { right: 24, top: 18 }]}>☁️</Text>
        <View style={styles.plots}>
          {garden.plots.map((plot, index) => (
            <Plot
              key={index}
              plot={plot}
              grow={grown === index}
              canPlant={!!childId && seeds > 0 && plot === null}
              selected={choosing === index}
              onPress={() => {
                setNote(null);
                setChoosing(index);
              }}
            />
          ))}
        </View>
        {plantedCount(garden) >= 2 && (
          <Animated.Image
            source={mascotSources.wave}
            resizeMode="contain"
            style={styles.peek}
            accessible={false}
          />
        )}
      </LinearGradient>
      <SpeechBubble
        pose={seeds > 0 ? "celebrate" : "idle_happy"}
        text={message}
        size={70}
        tone="mint"
      />
      {picker ? (
        <View style={styles.picker}>
          <Text style={styles.pickTitle}>{copy.pickPlant}</Text>
          <View style={styles.grid2}>
            {PLANTS.map((p) => {
              const open = unlockedPlants(earned).some((u) => u.id === p.id);
              return (
                <View key={p.id} style={styles.half}>
                  <ChoiceCard
                    emoji={open ? p.emoji : "🔒"}
                    label={open ? copy.plants[p.id] : copy.locked(p.unlockAt)}
                    onPress={() => open && void plantHere(p.id)}
                  />
                </View>
              );
            })}
          </View>
          <Button label={copy.cancel} variant="outline" onPress={() => setChoosing(null)} />
        </View>
      ) : (
        <Button
          label={`🌿 ${copy.takeBreak}`}
          onPress={() => {
            setNote(null);
            setStage("choose");
          }}
        />
      )}
    </GameShell>
  );
}

function Plot({
  plot,
  grow,
  canPlant,
  selected,
  onPress,
}: {
  plot: PlantId | null;
  grow: boolean;
  canPlant: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!grow || reduceMotion) return;
    scale.setValue(0.2);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }).start();
  }, [grow, reduceMotion, scale]);
  const emoji = plot ? PLANTS.find((p) => p.id === plot)?.emoji : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={plot ? copy.plants[plot] : copy.tapPlot}
      accessibilityState={{ disabled: !canPlant }}
      disabled={!canPlant}
      onPress={onPress}
      style={[styles.plot, selected && styles.plotSelected]}
    >
      {emoji ? (
        <Animated.Text style={[styles.plant, { transform: [{ scale }] }]}>{emoji}</Animated.Text>
      ) : (
        <Text style={styles.soil}>{canPlant ? "＋" : ""}</Text>
      )}
    </Pressable>
  );
}

/**
 * The break itself: Нүдхэн sends the child off, the screen dims with no timer to watch, and a
 * tap on return asks whether the break is done.
 */
function Away({
  activity,
  away,
  onGo,
  onConfirm,
  onCancel,
}: {
  activity: GardenBreak;
  away: boolean;
  onGo: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const startedAt = useRef(0);
  const [dimmed, setDimmed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [early, setEarly] = useState(false);

  useEffect(() => {
    if (!away) return;
    startedAt.current = Date.now();
    // A short goodbye wave, then the screen goes dark.
    const timer = setTimeout(() => setDimmed(true), 2500);
    return () => clearTimeout(timer);
  }, [away]);

  const confirm = () => {
    if (!canConfirmBreak(startedAt.current, Date.now(), activity.minSeconds)) return setEarly(true);
    setDimmed(false);
    onConfirm();
  };

  return (
    <View style={styles.away}>
      <Mascot variant="wave" size={200} motion="float" halo={world.white} />
      <Text style={styles.big}>{activity.emoji}</Text>
      <Text style={styles.story}>{copy.encourage}</Text>
      {!away ? (
        <View style={styles.wide}>
          <Button label={copy.go} onPress={onGo} />
          <Button label={copy.cancel} variant="outline" onPress={onCancel} />
        </View>
      ) : null}
      <Modal
        visible={dimmed}
        transparent
        animationType="fade"
        onRequestClose={() => setAsking(true)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.awayHint}
          onPress={() => setAsking(true)}
          style={styles.dim}
        >
          {asking ? (
            <View style={styles.ask}>
              <Text style={styles.askTitle}>{copy.confirm}</Text>
              {early ? <Text style={styles.askNote}>{copy.tooSoon}</Text> : null}
              <Button label={copy.confirmYes} onPress={confirm} />
              <Button
                label={copy.notYet}
                variant="outline"
                onPress={() => {
                  setAsking(false);
                  setEarly(false);
                }}
              />
              <Button
                label={copy.cancel}
                variant="link"
                onPress={() => {
                  setDimmed(false);
                  onCancel();
                }}
              />
            </View>
          ) : (
            <>
              <Text style={styles.dimTitle}>{copy.awayTitle}</Text>
              <Text style={styles.dimHint}>{copy.awayHint}</Text>
            </>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "flex-end" },
  seeds: {
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
  board: { borderRadius: 32, padding: 14, paddingTop: 54, overflow: "hidden" },
  cloud: { position: "absolute", top: 10, fontSize: 30 },
  plots: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  plot: {
    width: "31%",
    aspectRatio: 1.15,
    borderRadius: 22,
    backgroundColor: "#EBD7BC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "transparent",
  },
  plotSelected: { borderColor: world.purple },
  plant: { fontSize: 40, lineHeight: 48 },
  soil: { fontFamily: fonts.black, fontWeight: "900", fontSize: 26, color: "#B79772" },
  peek: { position: "absolute", right: 6, bottom: 4, width: 54, height: 54 },
  picker: { gap: 10 },
  pickTitle: { fontFamily: fonts.black, fontWeight: "900", fontSize: 18, color: world.navy },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  half: { width: "48%" },
  away: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  big: { fontSize: 48 },
  story: {
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 27,
    color: world.navy,
    textAlign: "center",
  },
  wide: { alignSelf: "stretch", gap: 10 },
  // Near-black and very low contrast, so the phone is barely lit while the child is away.
  dim: {
    flex: 1,
    backgroundColor: "#0D0A1A",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  dimTitle: {
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 20,
    color: "#5A5284",
    textAlign: "center",
  },
  dimHint: { color: "#3F3866", textAlign: "center" },
  ask: { alignSelf: "stretch", gap: 10, backgroundColor: "#1B1630", borderRadius: 28, padding: 20 },
  askTitle: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 20,
    color: "#CFC6F5",
    textAlign: "center",
  },
  askNote: { color: "#A99FD6", textAlign: "center" },
});
