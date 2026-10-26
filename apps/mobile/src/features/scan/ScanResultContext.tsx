import { createContext, useContext, useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { EyeMeasure, ScanResult } from "@app/core";

/** Eyes of the representative frame; kept in memory for the result screen, never saved. */
export type ResultEyes = readonly [EyeMeasure, EyeMeasure] | null;

const ScanResultContext = createContext<{
  result: ScanResult | null;
  setResult: Dispatch<SetStateAction<ScanResult | null>>;
  eyes: ResultEyes;
  setEyes: Dispatch<SetStateAction<ResultEyes>>;
} | null>(null);

export function ScanResultProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [eyes, setEyes] = useState<ResultEyes>(null);
  // Clearing the result (retry, leaving the scan) also drops the eyes.
  useEffect(() => {
    if (!result) setEyes(null);
  }, [result]);
  return (
    <ScanResultContext.Provider value={{ result, setResult, eyes, setEyes }}>
      {children}
    </ScanResultContext.Provider>
  );
}

export function useScanResult() {
  const context = useContext(ScanResultContext);
  if (!context) throw new Error("ScanResultProvider is required");
  return context;
}
