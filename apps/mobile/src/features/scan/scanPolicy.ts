import type { PolicyConfig } from "@app/core";

/**
 * referAsymmetry: refer when the reflexes suggest a manifest deviation above 8 prism dioptres,
 * the AAPOS target for instrument-based screening (Arnold et al., J AAPOS 2022;26:1.e1-1.e6,
 * doi:10.1016/j.jaapos.2021.09.009). The Hirschberg ratio in children is 19.9 ± 1.9 prism
 * dioptres per mm of reflex decentration, constant from 6 months to 11 years (Hasebe et al.,
 * IOVS 1998;39:2782-5), so 8 prism dioptres is 0.40 mm. The mean visible iris diameter is
 * 11.71 mm (Rüfer et al., Cornea 2005;24:259-61), a radius of 5.855 mm, giving
 * 0.40 / 5.855 = 0.069 iris radii. The diameter was measured at ages 10-80 and the ratio
 * varies between children, so this is a starting point, not a validated cut-off.
 *
 * minFramesUsed and maxSpread are measurement-quality settings, to be tuned from recorded
 * scans (docs/evaluation-workflow.md).
 */
export const SCAN_POLICY: PolicyConfig = {
  referAsymmetry: 0.069,
  minFramesUsed: 5,
  maxSpread: 0.1,
  validated: false,
};

/** Stored with each result so saved scans show which thresholds produced them. */
export const SCAN_POLICY_VERSION = "aapos-8pd-unvalidated-v2";

// Earlier unvalidated versions, so results saved with them keep their demo label.
const UNVALIDATED_VERSIONS = new Set([SCAN_POLICY_VERSION, "demo-unvalidated-v1"]);

/** True for results produced by thresholds that have not been validated. */
export function isUnvalidatedPolicy(version: string): boolean {
  return UNVALIDATED_VERSIONS.has(version);
}
