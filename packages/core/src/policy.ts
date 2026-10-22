import type { Decision, PolicyConfig, PolicyInput } from "./types";

/**
 * Turns a scan summary into one outcome. Rules are checked from the safest outcome down,
 * so a failed or poor-quality scan can never reach NO_VISIBLE_SIGN.
 */
export function decide(input: PolicyInput, config: PolicyConfig): Decision {
  assertValidConfig(config);
  const { summary, qualityReasons, failure } = input;

  if (failure) return { outcome: "NOT_ASSESSED", reasons: [failure] };
  if (!Number.isFinite(summary.framesUsed)) return modelError();

  if (summary.framesUsed < config.minFramesUsed) {
    return { outcome: "RETAKE", reasons: [...new Set(qualityReasons), "TOO_FEW_FRAMES"] };
  }

  const { asymmetryScore, spread } = summary;
  if (asymmetryScore === null || spread === null) return modelError();
  if (!Number.isFinite(asymmetryScore) || !Number.isFinite(spread)) return modelError();

  if (spread > config.maxSpread) return { outcome: "RETAKE", reasons: ["LOW_CONSISTENCY"] };
  if (asymmetryScore >= config.referAsymmetry) {
    return { outcome: "REFER", reasons: ["ASYMMETRY_ABOVE_THRESHOLD"] };
  }
  return { outcome: "NO_VISIBLE_SIGN", reasons: [] };
}

function modelError(): Decision {
  return { outcome: "NOT_ASSESSED", reasons: ["MODEL_ERROR"] };
}

// A NaN threshold would make every comparison false and silently skip a rule.
function assertValidConfig(config: PolicyConfig): void {
  if (!(config.referAsymmetry > 0)) throw new RangeError("referAsymmetry must be positive");
  if (!(config.maxSpread >= 0)) throw new RangeError("maxSpread must be non-negative");
  if (!(Number.isInteger(config.minFramesUsed) && config.minFramesUsed >= 1)) {
    throw new RangeError("minFramesUsed must be a positive integer");
  }
}
