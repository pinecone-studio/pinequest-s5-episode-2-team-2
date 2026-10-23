import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { hasCurrentConsent, loadConsent } from "./consent";

export type ConsentStatus = "loading" | "missing" | "accepted";

/** Reads the stored consent once per mount. */
export function useConsentStatus(): ConsentStatus {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<ConsentStatus>("loading");

  useEffect(() => {
    let active = true;
    loadConsent(db)
      .then((record) => {
        if (active) setStatus(hasCurrentConsent(record) ? "accepted" : "missing");
      })
      // Fail closed: if consent cannot be read, show onboarding again.
      .catch(() => {
        if (active) setStatus("missing");
      });
    return () => {
      active = false;
    };
  }, [db]);

  return status;
}
