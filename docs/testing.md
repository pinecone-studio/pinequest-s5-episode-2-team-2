# Testing

What the tests check and how to run them. All of it runs on a laptop without a phone,
camera or recordings; on-device checks are listed in the README and in the feature docs.

## Running

From the repository root:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test            # core and mobile
```

From `ml/`:

```bash
uv run ruff check . && uv run ruff format --check .
uv run pytest       # the training tests need: uv sync --group train
```

## Kinds of tests

| Kind            | Where                                                  | What it guards                                                                                                                       |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Unit tests      | next to the code, `*.test.ts(x)`, `ml/tests/test_*.py` | Each function and screen state, including error and empty cases                                                                      |
| Shared fixtures | `packages/core/fixtures/*.json`, read by both suites   | TypeScript (app) and Python (offline tools) give the same reasons, values and decisions ([`shared-fixtures.md`](shared-fixtures.md)) |
| Property tests  | `*Properties.test.ts`, `ml/tests/test_*_properties.py` | Rules that must hold for every input, checked over hundreds of seeded random cases                                                   |
| Real SQLite     | `apps/mobile/src/storage/*.test.ts`                    | Saving, reading, deleting and migrations on Node's SQLite engine, including reopening the file                                       |
| Screen tests    | `*Screen.test.tsx` with `react-test-renderer`          | What each state shows and which action each button takes; native modules are mocked                                                  |
| Synthetic bench | `ml/hirschberg/bench.py` (and its tests)               | Precision and failure modes of the reflex measurement on rendered eyes with known truth                                              |

## Rules the property tests hold

- **Safety of the outcome**: a model failure is always "not assessed"; "no visible sign"
  needs enough frames, a consistent scan and a score below the threshold; a larger score
  never makes a usable scan look safer; missing or non-finite values are never judged.
- **Scan summary**: frame order does not matter, rejected frames never change the score, a
  minority of outlier frames cannot move it.
- **Geometry**: offsets do not depend on where the eye is or how large it is; mirror-symmetric
  reflexes give zero; both eyes looking away doubles the asymmetry (why `NOT_LOOKING` exists).
- **Quality checks**: moving or scaling the face changes nothing but the distance checks; a
  mirrored face mirrors yaw and roll.
- **Storage**: every saved field round-trips; deleting a profile clears every table with a
  `child_id`; every upgrade path ends with the schema of a fresh install.
- **Everyday features**: treatment day totals add up to the recorded time, reminders are
  always in the future, the history and chart keep every scan once and in order.

## Writing a new test

- Use a fixed seed for generated cases so a failure can be reproduced.
- Pin the time zone (`process.env.TZ`) when a test depends on local days.
- Never add face or eye photos as test data; draw synthetic ones (`hirschberg.synthetic`) or
  use landmark coordinates.
- When the TypeScript and Python versions of a function change together, update the shared
  fixture and say why in the PR.
