import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { getActiveChildId } from "../../storage/activeChild";

/**
 * The child a screen works on: the `childId` route param, otherwise the selected profile
 * (falling back to the oldest). `undefined` while loading, `null` when there are no profiles.
 * Re-read on focus so a selection made on the Profile tab applies when returning.
 */
export function useActiveChildId(): string | null | undefined {
  const db = useSQLiteContext();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const [id, setId] = useState<string | null | undefined>(childId);

  useFocusEffect(
    useCallback(() => {
      if (childId) return setId(childId);
      let active = true;
      getActiveChildId(db).then(
        (selected) => active && setId(selected),
        () => active && setId(null),
      );
      return () => {
        active = false;
      };
    }, [db, childId]),
  );

  return id;
}
