import { isUnvalidatedPolicy, SCAN_POLICY, SCAN_POLICY_VERSION } from "./scanPolicy";

test("the refer threshold follows the sourced conversion of 8 prism dioptres", () => {
  const prismDioptres = 8;
  const hirschbergRatio = 19.9; // prism dioptres per mm, children
  const irisRadiusMm = 11.71 / 2;
  expect(SCAN_POLICY.referAsymmetry).toBeCloseTo(prismDioptres / hirschbergRatio / irisRadiusMm, 3);
  expect(SCAN_POLICY.validated).toBe(false);
});

test("results from the current and earlier unvalidated thresholds are marked as such", () => {
  expect(isUnvalidatedPolicy(SCAN_POLICY_VERSION)).toBe(true);
  expect(isUnvalidatedPolicy("demo-unvalidated-v1")).toBe(true);
  expect(isUnvalidatedPolicy("mock")).toBe(false);
});
