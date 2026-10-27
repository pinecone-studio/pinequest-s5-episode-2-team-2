import Constants from "expo-constants";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { deleteAllData } from "../../storage/deleteAllData";
import { cancelAllReminders } from "../habits/notify";
import { settingsCopy as copy } from "./copy";
import { confirmWithAlert, runDeleteFlow } from "./deleteFlow";

/** Set when the on-device model ships (#19); shown so parents and testers can report it. */
const MODEL_VERSION: string | null = null;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onDelete() {
    setBusy(true);
    setFailed(false);
    const outcome = await runDeleteFlow({
      confirm: () =>
        confirmWithAlert(Alert.alert, {
          title: copy.confirmTitle,
          message: copy.confirmMessage,
          cancel: copy.confirmCancel,
          confirm: copy.confirmDelete,
        }),
      deleteData: async () => {
        await deleteAllData(db);
        // No reminder about a deleted child may fire later.
        await cancelAllReminders();
      },
      onDeleted: () => {
        // Close every screen so nothing reachable still shows deleted data, then start over.
        if (router.canDismiss()) router.dismissAll();
        router.replace("/onboarding");
      },
    });
    setFailed(outcome === "failed");
    setBusy(false);
  }

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>

      <Card>
        <Text variant="caption">{copy.aboutTitle}</Text>
        <Text>
          {copy.appVersion}: {Constants.expoConfig?.version ?? "?"}
        </Text>
        <Text>
          {copy.modelVersion}: {MODEL_VERSION ?? copy.noModel}
        </Text>
      </Card>

      <Card>
        <Text variant="caption">{copy.privacyTitle}</Text>
        <Text>{copy.privacyBody}</Text>
      </Card>

      <Card>
        <Text variant="caption">{copy.deleteTitle}</Text>
        <Text>{copy.deleteBody}</Text>
        {failed && <Text accessibilityRole="alert">{copy.failed}</Text>}
        <Button
          label={copy.deleteButton}
          disabled={busy}
          onPress={() => void onDelete()}
          style={styles.danger}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: { backgroundColor: "#B91C1C" },
});
