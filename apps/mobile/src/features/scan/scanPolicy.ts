import type { PolicyConfig } from "@app/core";

/**
 * Thresholds for real scan results. Null until the team sets them from validated data with a
 * cited source; while null the scan keeps returning the labelled mock result.
 */
export const SCAN_POLICY: PolicyConfig | null = null;

/** Stored with each result so saved scans show which thresholds produced them. */
export const SCAN_POLICY_VERSION = "unset";
