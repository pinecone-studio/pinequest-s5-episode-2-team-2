# pinequest-s5-episode-2-team-2

A mobile app that lets parents run a short scan of their child's eyes with an iPhone, check
for signs associated with strabismus without an internet connection, and track eye health over
time. The app does not diagnose; it only indicates whether seeing an eye doctor is recommended.

- All analysis runs on the device (offline).
- Images are not stored and never leave the phone.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how we work.

## Structure

| Path             | Contents                                                    |
| ---------------- | ----------------------------------------------------------- |
| `apps/mobile/`   | Expo (React Native, TypeScript) app                         |
| `packages/core/` | Shared types, decision logic and mocks (`@app/core`, no UI) |
| `ml/`            | Annotation, fine-tuning, evaluation, export                 |
| `docs/`          | Capture protocol, model card, limitations                   |

## Documentation

| Topic                                          | Doc                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| How a scan becomes a result, module by module  | [architecture.md](docs/architecture.md)                                                                                                                                                    |
| Medical sources behind every threshold and tip | [references.md](docs/references.md)                                                                                                                                                        |
| What the tests check and how to run them       | [testing.md](docs/testing.md)                                                                                                                                                              |
| Frame quality checks and their limits          | [quality-checks.md](docs/quality-checks.md)                                                                                                                                                |
| The keypoint model and its evaluation          | [model-card.md](docs/model-card.md), [evaluation-report.md](docs/evaluation-report.md)                                                                                                     |
| Collecting and checking captures               | [capture-protocol.md](docs/capture-protocol.md), [data-dictionary.md](docs/data-dictionary.md), [consent-form.md](docs/consent-form.md), [calibration-sheet.md](docs/calibration-sheet.md) |
| From captures to thresholds                    | [evaluation-workflow.md](docs/evaluation-workflow.md)                                                                                                                                      |
| TypeScript and Python kept identical           | [shared-fixtures.md](docs/shared-fixtures.md)                                                                                                                                              |

## Development

Requires Node 22.13+ (see `.nvmrc`; mobile migration tests use Node's SQLite engine).

```bash
npm install
npm run lint
npm run typecheck
npm test
```

## Mobile app

Expo SDK 58, Expo Router, strict TypeScript and `@app/core` are wired into the npm workspace.
Run all commands below from the repository root. Install dependencies once with `npm install`;
use `npm ci` for a clean checkout with the committed lockfile.

### Run a development build on an iPhone

1. Install the full **Xcode** app on the Mac. Open it once to install its additional tools
   and iOS platform support. Command Line Tools alone are insufficient. In Xcode → Settings →
   Locations, select the installed Xcode under Command Line Tools.
2. Add your Apple ID in Xcode → Settings → Accounts. CocoaPods is required; Expo CLI offers
   to install it when creating the first native build.
3. Connect the iPhone by USB, accept **Trust This Computer**, and enable **Developer Mode**
   in Settings → Privacy & Security on the phone.
4. Run `npm run mobile:ios` and select the connected iPhone. This generates the native project,
   builds and installs the development app, and starts Metro.
5. If signing fails, open `apps/mobile/ios/*.xcworkspace` in Xcode. Select the app target →
   Signing & Capabilities → **Automatically manage signing** and your **Team**. If the bundle
   identifier is unavailable, agree on another identifier with the team, update
   `ios.bundleIdentifier` in `apps/mobile/app.json`, and rerun `npm run mobile:ios`.
6. For subsequent JavaScript/TypeScript changes, run `npm run mobile` and open the installed
   development app. Keep the Mac and iPhone on the same network. Rebuild with
   `npm run mobile:ios` after changing a native library or config plugin.

This project uses `expo-dev-client`. Expo Go is not required. For an Android development build,
run `npm run mobile:android` with Android Studio and its SDK installed.

### Structure and checks

- `apps/mobile/app/(tabs)/`: Home, Scan, History and Profile routes.
  The Scan stack uses `src/features/scan/`: a back-camera preview, alignment guide and tested
  `idle → aligning → scanning (3 s) → processing → done | failed` reducer. It collects measured
  frames, applies an explicitly unvalidated demo policy, and stores completed session metadata;
  images are never stored. See [measured scan integration](docs/real-scan-results.md) for limits.
  Other placeholders live in `src/features/scaffold/`.
  All pending app copy is marked `TODO(copy)` for the team to write in Mongolian before release.
- `apps/mobile/src/theme.ts`: colours, four outcome colours typed against `@app/core`, spacing,
  typography and radii. `src/components/ui.tsx` exports `Screen`, `Button`, `Card`, `Text`.
- `apps/mobile/src/storage/migrations.ts`: append the next consecutive migration. Never modify
  an already released migration. `SQLiteProvider.onInit` completes migrations before tabs render.
  Schema changes and `PRAGMA user_version` commit together or roll back together. Each feature
  owns its future tables; the initial migration only creates `app_metadata`.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` cover both workspaces.
  Mobile tests use an actual SQLite database to verify first launch, reopening, upgrades, rollback,
  retry and rejecting newer database versions. They do not exercise Expo's native bridge.
- `npm run mobile:export` verifies the iOS JavaScript bundle without Xcode. CI runs this in addition
  to the checks above. Native compilation and physical-device checks are separate.

### Scan development check (#10)

Rebuild the development app after installing dependencies: the preview uses VisionCamera 5.2.3
and its Nitro dependencies, with camera permission only (no microphone). This keeps the app's
Expo/RN versions; the standalone camera spike's V4 API is not copied into the production app.

On a real iPhone, using an object rather than a participant, check permission allow/deny and
the Settings recovery button. Prepare → Start should show three seconds of progress, turn the
torch off during processing and open the labelled unvalidated demo result. Cancel while aligning/scanning,
switch tabs, background the app and interrupt the camera: the torch must turn off, no late result
may open, and retry must work. Also check the result return button, device Back, a direct
`/scan/result` link with no result and large accessibility text. Completed session metadata is
saved for History; representative eyes stay only in the Scan stack's memory. The #78 device
checks remain pending; JavaScript export and reducer tests do not verify camera hardware.

### iPhone acceptance check

- Fresh install: app opens without an error, then all four tabs navigate correctly.
- Home button opens the Scan tab. Larger accessibility text remains readable.
- In the development SQLite inspector, `PRAGMA user_version` returns `1`, and `app_metadata`
  contains `initialized = 1`. Close and reopen the app: migration does not repeat or erase data.
- Existing install: build updates preserve stored data. Do not uninstall the app when checking
  upgrades, since uninstalling removes its local database.

References: [Expo Router setup](https://docs.expo.dev/router/installation/),
[monorepos](https://docs.expo.dev/guides/monorepos/),
[SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/),
[local development builds](https://docs.expo.dev/guides/local-app-development/).

## Dataset licenses

| Dataset                              | Source | License |
| ------------------------------------ | ------ | ------- |
| _(add a row for every dataset used)_ |        |         |
