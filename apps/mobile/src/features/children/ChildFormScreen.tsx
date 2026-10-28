import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { setActiveChildId } from "../../storage/activeChild";
import { createChild, deleteChild, getChild, updateChild } from "../../storage/children";
import { theme } from "../../theme";
import { childrenCopy as copy } from "./copy";
import { childFormFields, MAX_NAME_LENGTH, newChildId, parseChildForm } from "./form";
import type { ChildFormError } from "./form";

/** `/child/new` creates a profile and selects it; `/child/<id>` edits or deletes one. */
export default function ChildFormScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const [fields, setFields] = useState({ name: "", birthYear: "" });
  const [loaded, setLoaded] = useState(isNew);
  const [errors, setErrors] = useState<ChildFormError[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let active = true;
    getChild(db, id).then(
      (child) => {
        if (!active) return;
        if (child) setFields(childFormFields(child));
        setLoaded(true);
      },
      () => active && setLoaded(true),
    );
    return () => {
      active = false;
    };
  }, [db, id, isNew]);

  async function save() {
    const result = parseChildForm(fields);
    setFailed(false);
    if (!result.ok) return setErrors(result.errors);
    setErrors([]);
    try {
      if (isNew) {
        const child = await createChild(db, newChildId(), result.details);
        await setActiveChildId(db, child.id);
      } else {
        await updateChild(db, id, result.details);
      }
      router.back();
    } catch {
      setFailed(true);
    }
  }

  function confirmDelete() {
    Alert.alert(copy.deleteConfirm, undefined, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.delete,
        style: "destructive",
        onPress: () =>
          void deleteChild(db, id).then(
            () => router.back(),
            () => setFailed(true),
          ),
      },
    ]);
  }

  if (!loaded) return null;
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {isNew ? copy.add : copy.edit}
      </Text>
      <Card>
        <Text variant="caption">{copy.name}</Text>
        <TextInput
          value={fields.name}
          onChangeText={(name) => setFields((f) => ({ ...f, name }))}
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="words"
          accessibilityLabel={copy.name}
          style={styles.input}
        />
        <Text variant="caption">{copy.birthYear}</Text>
        <TextInput
          value={fields.birthYear}
          onChangeText={(birthYear) => setFields((f) => ({ ...f, birthYear }))}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
          accessibilityLabel={copy.birthYear}
          style={styles.input}
        />
        {errors.map((error) => (
          <Text key={error} accessibilityRole="alert">
            {copy.errors[error]}
          </Text>
        ))}
        {failed && <Text accessibilityRole="alert">{copy.errors.failed}</Text>}
        <Button label={copy.save} onPress={() => void save()} />
      </Card>
      <Button label={copy.cancel} onPress={() => router.back()} variant="link" />
      {!isNew && <Button label={copy.delete} onPress={confirmDelete} variant="danger" />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    fontSize: 18,
    color: theme.colors.text,
  },
});
