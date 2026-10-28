import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Switch, TextInput, View } from "react-native";
import { EmptyState } from "../../components/EmptyState";
import { Button, Card, Screen, Text } from "../../components/ui";
import {
  addHabit,
  getReminder,
  habitTotals,
  setReminder,
  type HabitTotals,
} from "../../storage/habits";
import { getChild } from "../../storage/children";
import { listSessions } from "../../storage/sessions";
import { theme } from "../../theme";
import { childrenCopy } from "../children/copy";
import { useActiveChildId } from "../children/useActiveChildId";
import { habitsCopy as copy } from "./copy";
import { syncChildReminders } from "./notify";
import { DEFAULT_FORMS, toForm, toReminder, type ReminderForm } from "./reminderForm";
import { planReminders } from "./reminderPlan";
import type { ReminderKind } from "./schedule";

const REMINDER_KINDS: ReminderKind[] = ["outdoor", "screen_break", "rescan"];

export default function HabitsScreen() {
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  const [totals, setTotals] = useState<HabitTotals>({ outdoor: 0, screen_break: 0 });
  const [forms, setForms] = useState(DEFAULT_FORMS);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!childId) return;
    const [today, ...saved] = await Promise.all([
      habitTotals(db, childId, new Date()),
      ...REMINDER_KINDS.map((kind) => getReminder(db, childId, kind)),
    ]);
    setTotals(today);
    setForms({
      outdoor: toForm("outdoor", saved[0] ?? null),
      screen_break: toForm("screen_break", saved[1] ?? null),
      rescan: toForm("rescan", saved[2] ?? null),
    });
  }, [db, childId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function act<T>(
    action: () => Promise<T>,
    success: (result: T) => string | null = () => null,
  ) {
    setMessage(null);
    try {
      const result = await action();
      await reload();
      setMessage(success(result));
    } catch {
      setMessage(copy.failed);
    }
  }

  function edit(kind: ReminderKind, change: Partial<ReminderForm>) {
    setForms((current) => ({ ...current, [kind]: { ...current[kind], ...change } }));
  }

  function saveReminders() {
    if (!childId) return;
    const reminders = REMINDER_KINDS.map((kind) => [kind, toReminder(kind, forms[kind])] as const);
    if (reminders.some(([, reminder]) => reminder === null)) return setMessage(copy.invalid);
    void act(
      async () => {
        for (const [kind, reminder] of reminders) {
          if (reminder) await setReminder(db, childId, kind, reminder);
        }
        const [child, sessions] = await Promise.all([
          getChild(db, childId),
          listSessions(db, childId),
        ]);
        const plan = planReminders(
          childId,
          Object.fromEntries(reminders),
          sessions[0]?.createdAt ?? null,
          new Date(),
        );
        const result = await syncChildReminders(childId, plan, (kind) =>
          copy.notification(kind, child?.name ?? ""),
        );
        return result;
      },
      (result) => (result === "denied" ? copy.permissionDenied : copy.saved),
    );
  }

  if (childId === undefined) return null;
  if (childId === null) {
    return (
      <Screen>
        <Text variant="title">{copy.title}</Text>
        <EmptyState
          icon="person-add-outline"
          message={copy.noChild}
          action={{
            label: childrenCopy.add,
            onPress: () => router.push({ pathname: "/child/[id]", params: { id: "new" } }),
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>

      <Card>
        <Text variant="caption">{copy.today}</Text>
        <Text>{copy.outdoor}</Text>
        <Text variant="title">{copy.outdoorTotal(totals.outdoor)}</Text>
        <View style={styles.row}>
          {[15, 30].map((min) => (
            <Button
              key={min}
              label={copy.addMinutes(min)}
              style={styles.flex}
              onPress={() => void act(() => addHabit(db, childId, "outdoor", min))}
            />
          ))}
        </View>
        <Text>{copy.screenBreaks}</Text>
        <Text variant="title">{copy.breakTotal(totals.screen_break)}</Text>
        <Button
          label={copy.addBreak}
          onPress={() => void act(() => addHabit(db, childId, "screen_break", 1))}
        />
      </Card>

      <Card>
        <Text variant="caption">{copy.remindersTitle}</Text>
        <Text variant="caption">{copy.remindersNote}</Text>
        {REMINDER_KINDS.map((kind) => (
          <View key={kind} style={styles.reminder}>
            <View style={styles.row}>
              <Text style={styles.flex}>{copy.reminderLabels[kind]}</Text>
              <Switch
                value={forms[kind].enabled}
                onValueChange={(enabled) => edit(kind, { enabled })}
                accessibilityLabel={copy.reminderLabels[kind]}
              />
            </View>
            <TextInput
              value={kind === "rescan" ? forms[kind].intervalDays : forms[kind].timeOfDay}
              onChangeText={(text) =>
                edit(kind, kind === "rescan" ? { intervalDays: text } : { timeOfDay: text })
              }
              keyboardType={kind === "rescan" ? "number-pad" : "numbers-and-punctuation"}
              maxLength={kind === "rescan" ? 3 : 5}
              accessibilityLabel={copy.reminderLabels[kind]}
              style={styles.input}
            />
          </View>
        ))}
        <Button label={copy.save} onPress={saveReminders} />
      </Card>

      {message && <Text accessibilityRole="alert">{message}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  flex: { flex: 1 },
  reminder: { gap: theme.spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    fontSize: 18,
    color: theme.colors.text,
  },
});
