import { createContext, useContext, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { ScanResult } from "@app/core";

const ScanResultContext = createContext<{
  result: ScanResult | null;
  setResult: Dispatch<SetStateAction<ScanResult | null>>;
} | null>(null);

export function ScanResultProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<ScanResult | null>(null);
  return (
    <ScanResultContext.Provider value={{ result, setResult }}>
      {children}
    </ScanResultContext.Provider>
  );
}

export function useScanResult() {
  const context = useContext(ScanResultContext);
  if (!context) throw new Error("ScanResultProvider is required");
  return context;
}
