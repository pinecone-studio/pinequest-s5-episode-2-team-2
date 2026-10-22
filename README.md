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

## Development

Requires Node 22+ (see `.nvmrc`).

```bash
npm install
npm run lint
npm run typecheck
npm test
```

Mobile app setup will be added with the app scaffold.

## Dataset licenses

| Dataset                              | Source | License |
| ------------------------------------ | ------ | ------- |
| _(add a row for every dataset used)_ |        |         |
