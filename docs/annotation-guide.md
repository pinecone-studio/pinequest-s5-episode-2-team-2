# Annotation guide: eye crops

Each task is one eye crop with three points pre-placed by the heuristic. Your job is to move
them to the right place, add missing ones, and flag crops you cannot label. Expect 20–40
seconds per crop. Crops come only from people with a signed consent form and stay on the
private Drive; never copy them to chat, personal cloud or the repo.

## Setup (once)

1. Copy the batch folder (`crops/` and `tasks.json`) from the Drive to your laptop.
2. Start Label Studio with local files allowed, pointing at that folder:

   ```bash
   LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED=true \
   LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT=/path/to/batch \
   uvx label-studio
   ```

3. Create a project. **Labeling Setup → Code**: paste `ml/dataset/labelstudio.xml`.
4. **Settings → Cloud Storage → Add Source Storage → Local files**, absolute path
   `/path/to/batch/crops`. Do not sync it; the tasks already point at the files.
5. **Import** `tasks.json`. The heuristic points appear as predictions on every task.

## The three points

| Label         | Where                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `iris_center` | Centre of the whole iris (the coloured disc), not the pupil. Imagine the full circle under the lids. |
| `iris_edge`   | On the iris/white boundary, on the side least covered by the lids (usually left or right, not top).  |
| `reflex`      | Centre of the small bright torch reflection on the cornea, inside or at the edge of the iris.        |

- Zoom in (mouse wheel) for every crop; place points to the nearest pixel you can.
- Dark iris and dark pupil look the same: use the iris/white boundary to find the circle.
- If the heuristic point is already right, leave it.

## Reflex

- Only the torch reflection counts: small, round, the brightest spot near the iris centre.
- Ignore window or lamp reflections (larger, shaped, often off to the side) and bright skin.
- If there is no torch reflection, **delete** the `reflex` point. Do not guess where it would be.

## Flag `unclear` instead of guessing

Tick `unclear` and submit when any of these is true:

- The eye is closed or the lids cover more than half of the iris.
- The crop is blurred so the iris edge cannot be seen.
- Glare, glasses or hair hide the iris.
- It is not an eye, or the crop is badly off-centre.

Unclear crops are left out of the dataset, so flagging costs nothing. A wrong point does.

## Daily routine (#34)

- 30–60 minutes a day, 60–100 crops per person in your assigned batch.
- 20 crops in every batch are labelled by two people to check agreement; label them on your
  own without looking at the other annotation.
- At the end, **Export → JSON** and put the file in the batch folder on the Drive, named
  `export_<your-name>_<yyyymmdd>.json`.
