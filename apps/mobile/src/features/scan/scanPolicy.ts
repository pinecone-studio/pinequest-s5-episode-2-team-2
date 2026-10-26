import type { PolicyConfig } from "@app/core";

// Demo values match the shared policy fixture; not validated for screening.
export const SCAN_POLICY: PolicyConfig = {
  referAsymmetry: 0.2,
  minFramesUsed: 5,
  maxSpread: 0.1,
  validated: false,
};

/** Stored with each result so saved scans show which thresholds produced them. */
export const SCAN_POLICY_VERSION = "demo-unvalidated-v1";
