import json

import pytest

from dataset.build import build, main, split_people


def point(label, x, y, size=40):
    return {
        "type": "keypointlabels",
        "original_width": size,
        "original_height": size,
        "value": {"x": 100 * x / size, "y": 100 * y / size, "keypointlabels": [label]},
    }


def task(person, i, result, cancelled=False):
    crop = f"crops/{person}_{i}.png"
    return {
        "data": {"crop": crop, "person_id": person, "device": "ip13", "condition": "N"},
        "annotations": [{"result": result, "was_cancelled": cancelled, "updated_at": "1"}],
        "predictions": [{"result": [point("iris_center", 21, 20), point("iris_edge", 29, 20)]}],
    }


def good():
    return [point("iris_center", 20, 20), point("iris_edge", 28, 20), point("reflex", 22, 19)]


def test_no_person_in_two_splits():
    tasks = [task(f"P{p:03d}", i, good()) for p in range(23) for i in range(5)]
    rows, _ = build(tasks, seed=0)
    splits_per_person = {}
    for row in rows:
        splits_per_person.setdefault(row["person_id"], set()).add(row["split"])
    assert all(len(s) == 1 for s in splits_per_person.values())
    assert {r["split"] for r in rows} == {"train", "val", "test"}


def test_split_is_deterministic_and_uses_every_person():
    people = {f"P{p:03d}" for p in range(20)}
    a, b = split_people(people, 0), split_people(people, 0)
    assert a == b and set(a) == people
    assert sorted(a.values()).count("train") == 14


def test_label_in_crop_pixels_with_radius_and_heuristic():
    rows, _ = build([task("P001", 0, good())], seed=0)
    row = rows[0]
    assert row["iris_center"] == pytest.approx([20, 20])
    assert row["iris_radius"] == pytest.approx(8)
    assert row["reflex"] == pytest.approx([22, 19])
    assert row["heuristic"]["iris_radius"] == pytest.approx(8)


def test_skips_unclear_cancelled_and_incomplete():
    unclear = good() + [{"type": "choices", "value": {"choices": ["unclear"]}}]
    tasks = [
        task("P001", 0, unclear),
        task("P001", 1, good(), cancelled=True),
        task("P001", 2, [point("iris_center", 20, 20)]),
        task("P001", 3, [point("iris_center", 20, 20), point("iris_edge", 26, 20)]),
    ]
    rows, skipped = build(tasks, seed=0)
    assert skipped == {"UNCLEAR": 1, "UNANNOTATED": 1, "MISSING_IRIS": 1}
    assert len(rows) == 1 and rows[0]["reflex"] is None


def test_one_command_writes_manifest_and_copies_crops(tmp_path):
    batch = tmp_path / "batch"
    (batch / "crops").mkdir(parents=True)
    tasks = [task(f"P{p:03d}", 0, good()) for p in range(6)]
    for t in tasks:
        (batch / t["data"]["crop"]).write_bytes(b"png")
    export = tmp_path / "export.json"
    export.write_text(json.dumps(tasks))
    out = tmp_path / "out"
    assert main([str(batch), str(export), "--out", str(out)]) == 0
    rows = [json.loads(line) for line in (out / "manifest.jsonl").read_text().splitlines()]
    assert len(rows) == 6
    assert all((out / r["crop"]).is_file() for r in rows)


def test_reads_heuristic_from_a_real_label_studio_export():
    # The JSON export lists predictions as ids and nests the prediction in the annotation.
    exported = task("P001", 0, good())
    exported["annotations"][0]["prediction"] = exported.pop("predictions")[0]
    exported["predictions"] = [1]
    rows, _ = build([exported], seed=0)
    assert rows[0]["heuristic"]["iris_radius"] == pytest.approx(8)


def test_prefers_the_heuristic_stored_in_task_data():
    # Imported annotations carry no prediction in the export; the task data still has it.
    t = task("P001", 0, good())
    t["predictions"] = [1]
    t["data"]["heuristic"] = {"iris_center": [19, 21], "iris_radius": 7.5, "reflex": None}
    rows, _ = build([t], seed=0)
    assert rows[0]["heuristic"] == {"iris_center": [19, 21], "iris_radius": 7.5, "reflex": None}
