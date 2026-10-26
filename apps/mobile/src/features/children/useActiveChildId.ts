import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { listChildren } from "../../storage/children";

/**
 * The child a screen works on: the `childId` route param, otherwise the first profile.
 * `undefined` while loading, `null` when there are no profiles. Replace the fallback with the
 * active-child selection from #23 once it exists.
 */
export function useActiveChildId(): string | null | undefined {
  const db = useSQLiteContext();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const [id, setId] = useState<string | null | undefined>(childId);

  useEffect(() => {
    if (childId) return setId(childId);
    let active = true;
    listChildren(db).then((children) => {
      if (active) setId(children[0]?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [db, childId]);

  return id;
}
