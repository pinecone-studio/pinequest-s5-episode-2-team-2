import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { EmptyState } from "../../components/EmptyState";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import { adviceCards, type AdviceCard, type AdviceId } from "./advice";
import { adviceCopy } from "./adviceCopy";
import { adviceImages } from "./adviceImages";
import { AdvicePicture } from "./AdvicePicture";
import { useReducedMotion } from "./useReducedMotion";

export function AdviceCarousel({
  cards = adviceCards,
  onOpen,
  onPageChange,
}: {
  cards?: readonly AdviceCard[];
  onOpen: (id: AdviceId) => void;
  onPageChange?: () => void;
}) {
  const { width, height, fontScale } = useWindowDimensions();
  // Reserve room for the card copy, paging controls and system/tab bars.
  const pictureHeight = Math.max(140, Math.min(380, height - 430));
  const reducedMotion = useReducedMotion();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [pageHeights, setPageHeights] = useState<Record<string, number>>({});
  const pageWidth = measuredWidth || Math.max(1, width - 40);
  const active = Math.min(index, Math.max(0, cards.length - 1));
  const activeRef = useRef(active);
  const scroll = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    scroll.current?.scrollTo({
      x: Math.min(activeRef.current, Math.max(0, cards.length - 1)) * pageWidth,
      animated: false,
    });
  }, [pageWidth, cards.length]);

  function select(next: number) {
    activeRef.current = next;
    setIndex(next);
    onPageChange?.();
    scroll.current?.scrollTo({ x: next * pageWidth, animated: !reducedMotion });
  }
  if (!cards.length)
    return <EmptyState icon="information-circle-outline" message={adviceCopy.missing} />;
  return (
    <View
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0) setMeasuredWidth(next);
      }}
    >
      <ScrollView
        ref={scroll}
        horizontal
        style={{ height: Math.max(0, ...Object.values(pageHeights)) || undefined }}
        contentContainerStyle={{ alignItems: "flex-start" }}
        pagingEnabled
        directionalLockEnabled
        nestedScrollEnabled
        alwaysBounceVertical={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const next = Math.max(
            0,
            Math.min(cards.length - 1, Math.round(event.nativeEvent.contentOffset.x / pageWidth)),
          );
          activeRef.current = next;
          setIndex(next);
        }}
      >
        {cards.map((card, position) => (
          <View
            key={card.id}
            onLayout={(event) => {
              const next = event.nativeEvent.layout.height;
              if (next > 0)
                setPageHeights((current) =>
                  current[card.id] === next ? current : { ...current, [card.id]: next },
                );
            }}
            style={{
              width: pageWidth,
              paddingHorizontal: 4,
            }}
            accessibilityElementsHidden={position !== active}
            importantForAccessibility={position !== active ? "no-hide-descendants" : "auto"}
          >
            <Pressable
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`${card.title}. ${card.summary}`}
              accessibilityHint={adviceCopy.openHint}
              onPress={() => onOpen(card.id)}
            >
              <AdvicePicture
                source={adviceImages[card.id]}
                height={
                  card.id === "outdoor-time"
                    ? Math.min(pictureHeight, ((pageWidth - 34) * 3) / 4)
                    : pictureHeight
                }
              />
              <View style={styles.copy}>
                <Text accessibilityRole="header" style={styles.title}>
                  {card.title}
                </Text>
                <Text numberOfLines={fontScale > 1.2 ? undefined : 2}>{card.summary}</Text>
                <Text style={styles.details}>{adviceCopy.details} ›</Text>
              </View>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View style={styles.pages}>
        {cards.map((card, position) => (
          <Pressable
            key={card.id}
            style={styles.page}
            accessibilityRole="button"
            accessibilityState={{ selected: active === position }}
            accessibilityLabel={adviceCopy.page(position + 1, cards.length, card.title)}
            onPress={() => select(position)}
          >
            <View style={[styles.dot, active === position && styles.selectedDot]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
    borderRadius: theme.radius.md,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  copy: { padding: 4, gap: 10 },
  title: { fontWeight: "800", fontSize: 20, lineHeight: 26 },
  details: { color: theme.colors.primary, fontWeight: "700" },
  pages: { flexDirection: "row", justifyContent: "center" },
  page: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.muted },
  selectedDot: { width: 24, backgroundColor: theme.colors.primary },
});
