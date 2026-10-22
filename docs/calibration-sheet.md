# Calibration sheet

Printable targets that make the eye turn by a **known angle**, so we can check that the model's
measured asymmetry grows with the real deviation. File: [`calibration-sheet.svg`](calibration-sheet.svg).

## Geometry

The person sits at distance `d` from the camera lens and looks at a target printed beside the
lens, offset sideways by `x`. The eye then turns away from the lens by angle `θ`:

```
x = d × tan(θ)          d = 350 mm (capture-protocol.md)
```

| Angle θ | Offset x at 35 cm | Prism dioptres (100 × tan θ) |
| ------- | ----------------- | ---------------------------- |
| 0°      | 0 mm (the lens)   | 0 Δ                          |
| 2.5°    | 15.3 mm           | 4.4 Δ                        |
| 5°      | 30.6 mm           | 8.7 Δ                        |
| 10°     | 61.7 mm           | 17.6 Δ                       |

Eye doctors usually describe deviation in prism dioptres (Δ), so the last column helps when
we talk to them. If the capture distance changes, regenerate the sheet: every offset scales
with `d`.

**What it does and does not simulate.** Both eyes look at the same target, so both turn
together. The torch reflex moves the same way in both eyes and the _mirrored asymmetry_
stays near zero. That is the point: calibration scans test that the reflex moves by the
expected amount per degree, and that looking off-centre alone does not produce a false
asymmetry. Real one-eyed deviation is covered by the adult-only `D` scans.

## Print and check

1. Open `calibration-sheet.svg` in a browser, print on A4 **landscape** at **100% / Actual size**
   (turn off "Fit to page").
2. Measure the black bar with a ruler: it must be exactly **100 mm**. If not, fix the printer
   scale and print again. Do not use a sheet that fails this check.
3. Glue the sheet to thin cardboard.

## Mount

1. Cut out the dashed circle in the centre.
2. Place the sheet over the back of the phone so the **main back lens** shows through the hole
   and the printed side faces the person. Poke a second hole where the **torch** is so it is
   not covered.
3. Keep the sheet flat and the target row level with the eyes.
4. Ask the person to look at each red dot in turn; record `target_angle_deg` and `target_dir`
   (`L`/`R` = the person's own left/right) in the data sheet.

## Known limits

- The phone's camera bump lifts the paper by a few millimetres; at 35 cm this changes the
  angle by less than 0.1° and can be ignored.
- If a target lands on another lens or the torch on your phone model, report it to the team
  before capturing instead of moving the target by hand.
