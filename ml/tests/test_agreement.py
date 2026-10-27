import json

import pytest

from dataset.agreement import annotations_by_crop, main, pairs, report


def point(label, x, y, size=40):
    return {
        "type": "keypointlabels",
        "original_width": size,
        "original_height": size,
        "value": {"x": 100 * x / size, "y": 100 * y / size, "keypointlabels": [label]},
    }


def unclear():
    return {"type": "choices", "value": {"choices": ["unclear"]}}


def annotation(person, result, stamp="1", cancelled=False):
    return {
        "completed_by": person,
        "result": result,
        "updated_at": stamp,
        "was_cancelled": cancelled,
    }


def task(crop, *annotations):
    return {"data": {"crop": crop}, "annotations": list(annotations)}


def eye(cx=20, ex=28, reflex=(22, 19)):
    result = [point("iris_center", cx, 20), point("iris_edge", ex, 20)]
    return result + ([point("reflex", *reflex)] if reflex else [])


def test_keeps_each_persons_latest_completed_annotation():
    tasks = [
        task(
            "a.png",
            annotation(1, eye(cx=10), "1"),
            annotation(1, eye(cx=20), "2"),
            annotation(2, eye(), "1", cancelled=True),
        )
    ]
    people = annotations_by_crop(tasks)["a.png"]
    assert list(people) == ["1"]
    assert people["1"] == eye(cx=20)


def test_measures_errors_in_iris_radii():
    tasks = [task("a.png", annotation(1, eye()), annotation(2, eye(cx=22, ex=30, reflex=(22, 23))))]
    [pair] = pairs(tasks)
    assert pair.center == pytest.approx(0.25)
    assert pair.radius == pytest.approx(0)
    assert pair.reflex == pytest.approx(0.5)
    assert pair.reflex_agrees and pair.unclear_agrees


def test_pairs_across_exports_and_flags_disagreement():
    first = [task("a.png", annotation(1, eye()))]
    second = [task("a.png", annotation(2, eye(reflex=None) + [unclear()]))]
    [pair] = pairs(first + second)
    assert pair.reflex is None
    assert not pair.reflex_agrees
    assert not pair.unclear_agrees


def test_single_annotations_are_not_pairs():
    assert pairs([task("a.png", annotation(1, eye()))]) == []


def test_report_and_cli(tmp_path, capsys):
    tasks = [
        task(f"{i}.png", annotation(1, eye()), annotation(2, eye(cx=20 + i, ex=28 + i)))
        for i in range(3)
    ]
    text = report(pairs(tasks))
    assert "3 double-annotated crops." in text
    assert "| Iris centre distance | 3 | 0.125 | 0.250 |" in text
    assert "Reflex visible/absent agreement: 3/3." in text

    path = tmp_path / "export.json"
    path.write_text(json.dumps(tasks), "utf8")
    assert main([str(path)]) == 0
    assert "# Annotation agreement" in capsys.readouterr().out
    path.write_text(json.dumps([task("a.png", annotation(1, eye()))]), "utf8")
    assert main([str(path)]) == 1


@pytest.mark.parametrize("missing", [None, "", " ", {}, {"email": "unknown"}, True, 1.5])
def test_unknown_reviewer_cannot_satisfy_double_annotation(missing):
    tasks = [task("a.png", annotation(missing, eye()), annotation(1, eye()))]
    assert pairs(tasks) == []


def test_absent_reviewer_is_not_counted():
    unknown = annotation(1, eye())
    del unknown["completed_by"]
    assert pairs([task("a.png", unknown, annotation(2, eye()))]) == []


def test_expanded_and_scalar_reviewer_ids_are_the_same_person():
    tasks = [
        task("a.png", annotation(1, eye(), "1")),
        task("a.png", annotation({"id": 1, "email": "first@example.test"}, eye(cx=22), "2")),
    ]
    assert pairs(tasks) == []
    assert annotations_by_crop(tasks)["a.png"]["1"] == eye(cx=22)
    tasks.append(task("a.png", annotation({"id": 2}, eye())))
    assert len(pairs(tasks)) == 1
