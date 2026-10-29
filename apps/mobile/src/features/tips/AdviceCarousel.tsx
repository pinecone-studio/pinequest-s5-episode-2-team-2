import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { EmptyState } from "../../components/EmptyState";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import { adviceCards, type AdviceCard, type AdviceId } from "./advice";
import { adviceCopy } from "./adviceCopy";
import { adviceImages } from "./adviceImages";
import { AdvicePicture } from "./AdvicePicture";

export function AdviceCarousel({
  cards = adviceCards,
  onOpen,
}: {
  cards?: readonly AdviceCard[];
  onOpen: (id: AdviceId) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const pageWidth = measuredWidth || Math.max(1, width - 40);
  const active = Math.min(index, Math.max(0, cards.length - 1));
  const activeRef = useRef(active);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({
      x: Math.min(activeRef.current, Math.max(0, cards.length - 1)) * pageWidth,
      animated: false,
    });
  }, [pageWidth, cards.length]);

  function select(next: number) {
    activeRef.current = next;
    setIndex(next);
    scroll.current?.scrollTo({ x: next * pageWidth, animated: true });
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
        pagingEnabled
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
            style={{ width: pageWidth, paddingHorizontal: 4 }}
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
              <AdvicePicture source={adviceImages[card.id]} />
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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#8EA9D8" },
  selectedDot: { width: 24, backgroundColor: theme.colors.primary },
});
