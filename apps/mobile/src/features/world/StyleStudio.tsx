import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { mascotSources } from "../../components/mascots";
import { Button, Text } from "../../components/ui";
import { useReduceMotion } from "../../components/useReduceMotion";
import { loadPlayState, savePlayState } from "../../storage/playState";
import { fonts } from "../../theme";
import { styleCopy as copy } from "./copy";
import {
  STYLE_CATEGORIES,
  STYLE_ITEMS,
  cleanOutfit,
  isUnlocked,
  toggleItem,
  type Outfit,
  type StyleCategory,
  type StyleItemId,
} from "./logic";
import { GameShell, world } from "./ui";

const STYLE_KEY = "style";
const BACKGROUNDS: Record<string, readonly [string, string]> = {
  none: [world.lavender, world.cream],
  clouds: ["#E3D6FF", "#F7F2FF"],
  garden: ["#DDF8EA", world.mint],
  night: ["#3B3170", "#6E5BC9"],
};

/**
 * Нүдхэний стилийн студи: dress up our own mascot. A creativity corner, not an eye exercise:
 * items unlock with stars from playing, and glasses are just a fun accessory here.
 */
export function StyleStudio({
  childId,
  totalStars,
  onExit,
}: {
  childId: string | null;
  totalStars: number;
  onExit: () => void;
}) {
  const db = useSQLiteContext();
  const [outfit, setOutfit] = useState<Outfit>({});
  const [category, setCategory] = useState<StyleCategory>("hat");
  const [saved, setSaved] = useState(false);
  const size = Math.min(250, useWindowDimensions().width * 0.62);

  useEffect(() => {
    if (!childId) return;
    loadPlayState(db, childId, STYLE_KEY, {}).then(
      (value) => setOutfit(cleanOutfit(value, totalStars)),
      () => undefined,
    );
  }, [db, childId, totalStars]);

  const save = async () => {
    if (!childId) return;
    await savePlayState(db, childId, STYLE_KEY, outfit).catch(() => undefined);
    setSaved(true);
  };

  return (
    <GameShell title={copy.title} onExit={onExit} colors={[world.lavender, world.peach]} scroll>
      <Text accessibilityRole="header" style={styles.heading}>
        {copy.heading}
      </Text>
      <LinearGradient colors={BACKGROUNDS[outfit.background ?? "none"]!} style={styles.stage}>
        <Backdrop id={outfit.background} />
        <Dressed outfit={outfit} size={size} />
        <View style={styles.floorShadow} />
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {STYLE_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="tab"
            accessibilityState={{ selected: c === category }}
            onPress={() => setCategory(c)}
            style={[styles.tab, c === category && styles.tabOn]}
          >
            <Text style={[styles.tabText, c === category && styles.tabTextOn]}>
              {copy.categories[c]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.tray}>
        {STYLE_ITEMS.filter((item) => item.category === category).map((item) => {
          const open = isUnlocked(item, totalStars);
          const on = outfit[item.category] === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={open ? copy.items[item.id] : copy.locked(item.unlockAt)}
              accessibilityState={{ selected: on, disabled: !open }}
              onPress={() => {
                setSaved(false);
                setOutfit((current) => toggleItem(current, item, totalStars));
              }}
              style={({ pressed }) => [
                styles.item,
                on && styles.itemOn,
                !open && styles.itemLocked,
                pressed && styles.pressed,
              ]}
            >
              <Text maxFontSizeMultiplier={1} style={styles.itemEmoji}>
                {open ? item.emoji : "🔒"}
              </Text>
              <Text numberOfLines={3} style={styles.itemLabel}>
                {open ? copy.items[item.id] : copy.locked(item.unlockAt)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {childId ? (
        <Button label={saved ? `✓ ${copy.saved}` : copy.save} onPress={() => void save()} />
      ) : (
        <Text style={styles.note}>{copy.noChild}</Text>
      )}
    </GameShell>
  );
}

/** Pops a newly worn item in place, like snapping it on. */
function Pop({ children, style }: { children: ReactNode; style: object }) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.3)).current;
  useEffect(() => {
    if (reduceMotion) return scale.setValue(1);
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [reduceMotion, scale]);
  return (
    <Animated.View style={[styles.abs, style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Our mascot with the chosen items drawn on top. Positions are fractions of the picture, so
 * everything stays in place on every iPhone size. The eye sits at about (0.53, 0.44).
 */
export function Dressed({ outfit, size }: { outfit: Outfit; size: number }) {
  const s = size;
  const eye = { x: 0.535 * s, y: 0.44 * s };
  const ring = 0.42 * s;
  return (
    <View style={{ width: s, height: s }} accessible accessibilityLabel={copy.heading}>
      {outfit.outfit === "astronaut" && (
        <Pop key="helmet" style={{ left: -0.05 * s, top: -0.04 * s }}>
          <View
            style={[styles.helmet, { width: 1.1 * s, height: 1.1 * s, borderRadius: 0.55 * s }]}
          />
        </Pop>
      )}
      <Image
        source={mascotSources.idle_happy}
        resizeMode="contain"
        style={{ width: s, height: s }}
        accessible={false}
      />
      {outfit.outfit === "explorer" ? (
        <Pop key="belt" style={{ left: 0.23 * s, top: 0.7 * s }}>
          <View style={[styles.belt, { width: 0.6 * s, height: 0.07 * s }]}>
            <Text style={{ fontSize: 0.09 * s }}>🧭</Text>
          </View>
        </Pop>
      ) : outfit.outfit === "gardener" ? (
        <Pop key="apron" style={{ left: 0.33 * s, top: 0.6 * s }}>
          <View style={[styles.apron, { width: 0.4 * s, height: 0.26 * s }]}>
            <Text style={{ fontSize: 0.09 * s }}>🌱</Text>
          </View>
        </Pop>
      ) : (
        outfit.outfit === "astronaut" && (
          <Pop key="badge" style={{ left: 0.12 * s, top: 0.78 * s }}>
            <Text style={{ fontSize: 0.12 * s }}>🚀</Text>
          </Pop>
        )
      )}
      {outfit.glasses && (
        <Pop key={outfit.glasses} style={{ left: eye.x - ring / 2, top: eye.y - ring / 2 }}>
          {outfit.glasses === "starFrames" ? (
            <Ionicons
              name="star-outline"
              size={ring * 1.3}
              color={world.gold}
              style={{ marginLeft: -ring * 0.15, marginTop: -ring * 0.2 }}
            />
          ) : (
            <View
              style={[
                styles.lens,
                { width: ring, height: ring, borderRadius: ring / 2, borderWidth: 0.045 * s },
                outfit.glasses === "colorful" && styles.rainbow,
              ]}
            />
          )}
        </Pop>
      )}
      {outfit.hat && (
        <Pop key={outfit.hat} style={{ left: 0.53 * s - 0.15 * s, top: -0.14 * s }}>
          {outfit.hat === "crown" ? (
            <Text style={{ fontSize: 0.24 * s, width: 0.3 * s, textAlign: "center" }}>👑</Text>
          ) : (
            <View style={{ width: 0.3 * s, alignItems: "center" }}>
              <View style={[styles.pompom, { width: 0.06 * s, height: 0.06 * s }]} />
              <View
                style={{
                  borderLeftWidth: 0.11 * s,
                  borderRightWidth: 0.11 * s,
                  borderBottomWidth: (outfit.hat === "starHat" ? 0.26 : 0.2) * s,
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderBottomColor: outfit.hat === "starHat" ? world.purpleDeep : "#FF8FB1",
                }}
              />
              {outfit.hat === "starHat" && (
                <Text style={[styles.abs, { top: 0.12 * s, fontSize: 0.08 * s }]}>⭐</Text>
              )}
            </View>
          )}
        </Pop>
      )}
      {outfit.accessory && (
        <Pop
          key={outfit.accessory}
          style={
            outfit.accessory === "flower"
              ? { left: 0.7 * s, top: 0.06 * s }
              : outfit.accessory === "backpack"
                ? { left: -0.02 * s, top: 0.42 * s }
                : { left: 0.82 * s, top: 0.26 * s }
          }
        >
          <Text style={{ fontSize: 0.17 * s }}>
            {outfit.accessory === "flower" ? "🌸" : outfit.accessory === "backpack" ? "🎒" : "🪄"}
          </Text>
        </Pop>
      )}
    </View>
  );
}

function Backdrop({ id }: { id: StyleItemId | undefined }) {
  if (id === "clouds")
    return (
      <>
        <Text style={[styles.abs, styles.deco, { top: 14, left: 16 }]}>☁️</Text>
        <Text style={[styles.abs, styles.deco, { top: 30, right: 20 }]}>☁️</Text>
      </>
    );
  if (id === "garden")
    return (
      <Text style={[styles.abs, styles.deco, { bottom: 8, left: 16, letterSpacing: 6 }]}>
        🌷🌼🌷
      </Text>
    );
  if (id === "night")
    return (
      <>
        <Text style={[styles.abs, styles.deco, { top: 12, left: 20 }]}>✨</Text>
        <Text style={[styles.abs, styles.deco, { top: 24, right: 26 }]}>⭐</Text>
        <Text style={[styles.abs, styles.deco, { bottom: 20, right: 16 }]}>✨</Text>
      </>
    );
  return null;
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  heading: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: world.purpleDeep,
    textAlign: "center",
    marginBottom: 6,
  },
  stage: {
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    overflow: "hidden",
  },
  floorShadow: {
    width: 140,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(40,51,84,0.12)",
    marginTop: -6,
  },
  deco: { fontSize: 28 },
  helmet: {
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(220,235,255,0.35)",
  },
  belt: {
    borderRadius: 999,
    backgroundColor: "#A9744F",
    alignItems: "center",
    justifyContent: "center",
  },
  apron: {
    borderRadius: 18,
    backgroundColor: "#8FD3B6",
    alignItems: "center",
    justifyContent: "center",
  },
  lens: { borderColor: world.navy, backgroundColor: "rgba(255,255,255,0.12)" },
  rainbow: {
    borderTopColor: "#FF8FB1",
    borderRightColor: "#FFD166",
    borderBottomColor: "#5FC4A6",
    borderLeftColor: "#8E79DF",
  },
  pompom: { borderRadius: 999, backgroundColor: world.gold, marginBottom: -2 },
  tabBar: { flexGrow: 0 },
  tabs: { gap: 8, paddingVertical: 12, alignItems: "center" },
  tab: {
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: world.white,
    justifyContent: "center",
  },
  tabOn: { backgroundColor: world.purple },
  tabText: { fontFamily: fonts.extraBold, fontSize: 15, color: world.navy },
  tabTextOn: { color: world.white },
  tray: { flexDirection: "row", gap: 8, marginBottom: 12 },
  item: {
    flex: 1,
    minHeight: 104,
    borderRadius: 24,
    backgroundColor: world.white,
    borderWidth: 3,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    gap: 4,
  },
  itemOn: { borderColor: world.mintDeep, backgroundColor: world.mint },
  itemLocked: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.96 }] },
  itemEmoji: { fontSize: 34, lineHeight: 42 },
  itemLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    color: world.navy,
    textAlign: "center",
  },
  note: { textAlign: "center", color: "#5D5A7A" },
});
