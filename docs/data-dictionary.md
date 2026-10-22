# Data dictionary

One row per captured video, kept in the team's private data sheet (not in git).
Fields marked **private** may identify a person or are sensitive and must never be copied
outside the private Drive.

| Field | Type | Example | Notes |
| ----- | ---- | ------- | ----- |
| `file_name` | text | `P007_C05L_r1_ip13_20261024.mov` | Must follow `docs/capture-protocol.md` section 6. |
| `person_id` | text | `P007` | Pseudonymous. The link to a real name exists only on the consent form. |
| `consent_id` | text | `CF-007` | Number written on the signed consent form. **private** |
| `session_id` | text | `S03` | One session = one place, one day, one operator. |
| `capture_date` | date | `2026-10-24` | |
| `operator` | text | `oyuka` | Team member who captured. |
| `age_group` | enum | `child` / `adult` | |
| `age_years` | integer | `6` | Optional. Whole years only, no birth date. **private** |
| `device` | text | `iPhone 13` | |
| `camera` | enum | `back` | Always `back` per protocol; record if different. |
| `torch` | enum | `on` / `off` | |
| `distance_cm` | number | `35` | Measured lens to bridge of nose. |
| `phone_mount` | enum | `stand` / `handheld` | |
| `room_light` | enum | `dim` / `normal` | |
| `glasses_usually` | enum | `yes` / `no` / `unknown` | Glasses are always removed for capture. |
| `known_strabismus` | enum | `yes` / `no` / `unknown` | Only as reported by the person or parent. **private** |
| `scan_type` | enum | `N` / `C` / `D` | |
| `target_angle_deg` | number | `5` | `0`, `2.5`, `5` or `10` for `C`; empty otherwise. |
| `target_dir` | enum | `L` / `R` | From the person's point of view; empty for 0° and non-`C`. |
| `deviated_eye` | enum | `left` / `right` | `D` scans only: the eye the adult turned. |
| `repeat` | integer | `1` | |
| `usable` | enum | `yes` / `no` | After the check in protocol section 7. |
| `exclude_reason` | text | `blur` | Use the `QualityReason` names from `packages/core` when they fit (`BLUR`, `EYES_CLOSED`, ...). |
| `notes` | text | `child looked away at end` | No names or diagnoses in free text. |

## Rules

- Never store names, phone numbers, addresses or photos in the sheet.
- If someone withdraws, delete their rows and their files on the same day and note the
  `person_id` as withdrawn in the session log.
