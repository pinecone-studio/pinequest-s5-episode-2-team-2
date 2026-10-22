# Capture protocol

How we capture eye images for training and evaluating the model, so that every capture is
comparable no matter who took it. Read this fully before your first session.

> **No capture without a signed consent form.** For a child, a parent or guardian signs.
> See `docs/consent-form.md`. Signed forms and all captures live in the team's private Drive,
> never in git.

## 1. Equipment

| Item | Notes |
| ---- | ----- |
| iPhone with a back torch | Record the model in the data sheet. Use the same phone for a whole session. |
| Phone stand or tripod | Hand-held only if no stand is available; note it in the data sheet. |
| 35 cm measuring string or ruler | From the camera lens to the bridge of the nose. |
| Printed calibration sheet | `docs/calibration-sheet.md`, printed at 100% scale and checked with a ruler. |
| Chair | The person sits upright with the head straight. |

## 2. Room

- Dim the room lights so the pupils are large and the torch reflex is clearly visible.
  Do not make the room fully dark: the operator must still be able to see the screen.
- No window or lamp **behind the phone** (it causes extra reflections in the eye).
- No bright light **behind the person** (it darkens the face).
- Same room setup for the whole session. Note `room_light` in the data sheet: `dim` or `normal`.

## 3. Position

1. The person sits upright, head straight (not tilted or turned), glasses **off**.
2. Place the phone on the stand at the person's **eye height**, back camera facing them.
3. Measure **35 cm** from the camera lens to the bridge of the nose. Re-measure if anyone moves.
4. Both eyes must be fully inside the frame, centred, with no hair or hands covering them.
5. Turn the **torch on** (continuous light, not the photo flash).

## 4. What the person looks at

| Scan type | Code | Look at |
| --------- | ---- | ------- |
| Normal | `N` | The camera lens (the small dark circle, not the torch). |
| Calibration | `C` | A target on the calibration sheet taped around the lens (see the sheet). |
| Intentional deviation | `D` | Adults only: deliberately cross or turn one eye while the other looks at the lens. |

For children, say: "Look at the little black circle." A small sticker next to the lens helps.

## 5. Scans per person

Each scan is a **3-second video** at 30 fps with the torch on. Single frames are extracted
later, so one video gives many frames.

| Scan type | Repeats | Who |
| --------- | ------- | --- |
| `N` normal | 3 | Everyone |
| `C` calibration: 0°, 2.5°, 5°, 10° to the left and to the right | 1 each (7 videos) | Everyone who can follow targets |
| `D` intentional deviation | 2 | Adults only, never children |

Between repeats, ask the person to blink and look away for a moment, then reset to the target.
Stop immediately if a child is tired or upset; a partial session is fine.

## 6. File naming

```
P{person}_{type}{angle}{dir}_r{repeat}_{device}_{yyyymmdd}.mov
```

| Part | Example | Meaning |
| ---- | ------- | ------- |
| `person` | `P007` | Pseudonymous id from the data sheet. **Never** a name. |
| `type` | `N`, `C`, `D` | Scan type from section 4. |
| `angle` | `00`, `25`, `05`, `10` | Calibration angle: `25` means 2.5°. Empty for `N` and `D`. |
| `dir` | `L`, `R` | Calibration direction from the person's point of view. Empty for 0°, `N` and `D`. |
| `repeat` | `r1` | Repeat number. |
| `device` | `ip13` | Phone model, short. |
| `yyyymmdd` | `20261024` | Capture date. |

Examples: `P007_N_r2_ip13_20261024.mov`, `P007_C05L_r1_ip13_20261024.mov`,
`P012_D_r1_ip15_20261025.mov`.

## 7. After each person

1. Check every video: eyes open, in focus, reflex visible in both eyes. Retake if not.
2. Fill one row per video in the data sheet (`docs/data-dictionary.md`).
3. Upload to the private Drive folder for that session. Delete the videos from the phone
   (including "Recently Deleted") once the upload is confirmed.

## 8. Privacy checklist

- [ ] Signed consent before the first video.
- [ ] Person ids only; names stay on the consent form.
- [ ] No captures in git, chat apps or personal cloud backups.
- [ ] The person (or parent) can withdraw at any time: delete their files and data rows.

## Open questions

- Video vs burst photos: confirm with the ML owner that 3-second videos work for annotation.
- 35 cm comes from the issue; confirm it matches the distance the app will guide users to.
