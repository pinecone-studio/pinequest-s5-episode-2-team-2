import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Text } from "../../components/ui";
import { getActiveChildId, setActiveChildId } from "../../storage/activeChild";
import { listChildren, type Child } from "../../storage/children";
import { theme } from "../../theme";
import { childrenCopy as copy } from "./copy";

/** Profiles on the Profile tab: tap to select, edit, or add a new one. */
export function ChildrenList() {
  const db = useSQLiteContext();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    Promise.all([listChildren(db), getActiveChildId(db)]).then(
      ([rows, selected]) => {
        if (!active) return;
        setChildren(rows);
        setActiveId(selected);
      },
      () => active && setChildren([]),
    );
    return () => {
      active = false;
    };
  }, [db]);
  useFocusEffect(load);

  async function select(id: string) {
    await setActiveChildId(db, id);
    setActiveId(id);
  }

  if (children === null) return null;
  return (
    <Card>
      <Text style={styles.heading} accessibilityRole="header">
        {copy.title}
      </Text>
      {children.length === 0 && <Text>{copy.empty}</Text>}
      {children.map((child) => {
        const selected = child.id === activeId;
        return (
          <View key={child.id} style={[styles.row, selected && styles.selected]}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={child.name}
              onPress={() => void select(child.id)}
              style={styles.name}
            >
              <Text style={selected ? styles.bold : undefined}>{child.name}</Text>
              <Text variant="caption" style={styles.muted}>
                {selected ? copy.active : (child.birthYear ?? "")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${copy.edit}: ${child.name}`}
              onPress={() => router.push({ pathname: "/child/[id]", params: { id: child.id } })}
              style={styles.edit}
            >
              <Text style={styles.link}>{copy.edit}</Text>
            </Pressable>
          </View>
        );
      })}
      <Button
        label={copy.add}
        onPress={() => router.push({ pathname: "/child/[id]", params: { id: "new" } })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
  },
  selected: { borderColor: theme.colors.primary, borderWidth: 2 },
  name: { flex: 1, padding: theme.spacing.md },
  bold: { fontWeight: "700" },
  muted: { color: theme.colors.muted },
  edit: { padding: theme.spacing.md },
  link: { color: theme.colors.primary, fontWeight: "600" },
});
