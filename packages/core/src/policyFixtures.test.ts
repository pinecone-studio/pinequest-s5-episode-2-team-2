import { decide } from "./policy";
import type { Decision, PolicyConfig, PolicyInput } from "./types";

// Shared with ml/tests/test_policy.py so the Python reference and the app agree.
interface Fixtures {
  config: PolicyConfig;
  cases: (PolicyInput & { name: string; expected: Decision })[];
}

const fixtures = jest.requireActual<Fixtures>("../fixtures/policy.json");

test.each(fixtures.cases)(
  "policy fixture: $name",
  ({ summary, qualityReasons, failure, expected }) => {
    expect(decide({ summary, qualityReasons, failure }, fixtures.config)).toEqual(expected);
  },
);
