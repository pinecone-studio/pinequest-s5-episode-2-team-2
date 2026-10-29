# Нүдхэн mascots

Seven poses of the team's purple one-eyed mascot, provided by the team (cut out of the UI
concept poster with a transparent background). They are small raster exports, fine for
small and medium UI; redraw from a high-resolution source before any large-format use.
They are not covered by the MIT licence in `../branding/`.

| File             | Where it is used                                                |
| ---------------- | --------------------------------------------------------------- |
| `idle_happy.png` | Native splash (`app.json`), onboarding welcome, games banner    |
| `wave.png`       | Home greeting                                                   |
| `thinking.png`   | E chart setup, scan retake/failed states, RETAKE/NOT_ASSESSED   |
| `camera.png`     | Onboarding "how to" page (test chooser card after #264 lands)   |
| `search.png`     | Scan "processing" state                                         |
| `celebrate.png`  | After a finished check: thanks for taking part, never a verdict |
| `guide.png`      | Onboarding "no diagnosis" page (parent tips after #265 lands)   |

Rules (see `src/components/Mascot.tsx`): one mascot per screen, never over the live camera
preview or during the E chart test, motion only on welcome/home/completion and never with
Reduce Motion on.
