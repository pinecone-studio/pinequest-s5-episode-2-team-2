import { createContext, useContext, useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { EyeMeasure, ScanResult } from "@app/core";
import type { ResultPhotos } from "../eyeView/EyePhotoView";

/** Eyes of the representative frame; kept in memory for the result screen, never saved. */
export type ResultEyes = readonly [EyeMeasure, EyeMeasure] | null;

const ScanResultContext = createContext<{
  result: ScanResult | null;
  setResult: Dispatch<SetStateAction<ScanResult | null>>;
  eyes: ResultEyes;
  setEyes: Dispatch<SetStateAction<ResultEyes>>;
  /** The representative frame's eye crops, like the web demo's result; never saved. */
  photos: ResultPhotos | null;
  setPhotos: Dispatch<SetStateAction<ResultPhotos | null>>;
} | null>(null);

export function ScanResultProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [eyes, setEyes] = useState<ResultEyes>(null);
  const [photos, setPhotos] = useState<ResultPhotos | null>(null);
  // Clearing the result (retry, leaving the scan) also drops the eyes and their crops.
  useEffect(() => {
    if (!result) {
      setEyes(null);
      setPhotos(null);
    }
  }, [result]);
  return (
    <ScanResultContext.Provider value={{ result, setResult, eyes, setEyes, photos, setPhotos }}>
      {children}
    </ScanResultContext.Provider>
  );
}

export function useScanResult() {
  const context = useContext(ScanResultContext);
  if (!context) throw new Error("ScanResultProvider is required");
  return context;
}
