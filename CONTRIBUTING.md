# Contributing

## Branches

- `main` is protected: no direct pushes, every change lands through a PR.
- Pull the latest `main`, then create a branch per task: `<type>/<short-task>`
  - `feat/scan-torch`
  - `fix/policy-retake`
  - `chore/ci-cache`
  - `docs/data-protocol`
- One branch = one task = one PR. Don't bundle unrelated changes.

## Commits

- Use Conventional Commits: `feat(mobile): add scan state machine`,
  `fix(ml): handle missing glint`.
- Scopes: `mobile`, `ml`, `docs`, `ci`.

## Pull requests

- Keep PRs small: roughly under 300 lines, about a day of work. Split anything bigger.
- Open a draft PR early instead of sitting on finished work until the end of the day.
- Fill in the template: what, why, how it was tested, risks. Attach screenshots for UI
  changes and metrics for ML changes.
- Link the issue with `Closes #12`.
- Merge only after at least one approval from another teammate and a green CI run.
  Use **squash merge**.
- Never approve or merge your own PR.
- After merging, delete the branch, pull `main`, and start the next task from there.

## Reviews

- Check for contract (shared type) changes, missing tests, and privacy rule violations.
- Review pairs: _(to be added once roles are assigned)_

## Before you push

- Lint, typecheck and tests pass locally. _(commands will be added with the project scaffold)_

## Data and privacy (mandatory)

- **Never commit photos or videos of anyone's face or eyes.** Datasets live in the team's
  private Drive.
- Never capture anyone's images without a signed consent form. For children, parental
  consent is required.
- By default the app does not store images, send them over the network, or log them.
- Model weights (`*.pt`, `*.onnx`, `*.tflite`) are not committed.
- When adding a dataset, record its source and license in `README.md`.
- Never commit API keys or `.env` files.

## App copy

- All user-facing app text is in Mongolian.
- Never use wording that implies a diagnosis or that the eyes are healthy or normal. The app
  does not diagnose; it only indicates whether seeing an eye doctor is recommended.
- Results have four states: refer to a doctor, retake, not assessable, no visible sign.
- Poor image quality or low model confidence must never produce "no visible sign".
- Every result screen shows a notice that the app does not replace an eye exam.
