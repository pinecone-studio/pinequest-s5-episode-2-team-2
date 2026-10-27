"""Properties of the annotator agreement over generated double-annotated crops."""

import numpy as np
import pytest

from dataset.agreement import compare, pairs


def point(label, x, y, size=40):
    return {
        "type": "keypointlabels",
        "original_width": size,
        "original_height": size,
        "value": {"x": 100 * x / size, "y": 100 * y / size, "keypointlabels": [label]},
    }


def eye(cx, cy, r, reflex):
    result = [point("iris_center", cx, cy), point("iris_edge", cx + r, cy)]
    return result + ([point("reflex", *reflex)] if reflex else [])


def annotation(person, result, stamp="1"):
    return {"completed_by": person, "result": result, "updated_at": stamp, "was_cancelled": False}


rng = np.random.default_rng(11)
CROPS = []
for i in range(150):
    cx, cy, r = rng.uniform(15, 25, 2).tolist() + [float(rng.uniform(6, 10))]
    a = eye(cx, cy, r, (cx + rng.uniform(-2, 2), cy + rng.uniform(-2, 2)))
    jitter = rng.normal(0, 0.8, 4)
    b = eye(cx + jitter[0], cy + jitter[1], r + jitter[2] / 2, (cx + jitter[3], cy))
    CROPS.append((f"{i}.png", a, b))


def test_swapping_the_two_annotators_gives_the_same_errors():
    for crop, a, b in CROPS:
        ab, ba = compare(crop, a, b), compare(crop, b, a)
        assert ab.center == pytest.approx(ba.center)
        assert ab.radius == pytest.approx(ba.radius)
        assert ab.reflex == pytest.approx(ba.reflex)


def test_identical_labels_agree_perfectly():
    for crop, a, _ in CROPS:
        p = compare(crop, a, a)
        assert p.center == pytest.approx(0) and p.radius == pytest.approx(0)
        assert p.reflex == pytest.approx(0)


def test_errors_do_not_depend_on_the_crop_size():
    # Coordinates are stored as percentages, so the same labels on a crop twice the size
    # give the same errors in iris radii.
    def doubled(result):
        return [
            {**item, "original_width": 80, "original_height": 80}
            if "original_width" in item
            else item
            for item in result
        ]

    for crop, a, b in CROPS[:50]:
        small, large = compare(crop, a, b), compare(crop, doubled(a), doubled(b))
        assert large.center == pytest.approx(small.center)
        assert large.reflex == pytest.approx(small.reflex)


def test_only_each_persons_latest_label_counts():
    for crop, a, b in CROPS[:50]:
        tasks = [
            {
                "data": {"crop": crop},
                "annotations": [
                    annotation(1, b, "1"),  # superseded by the same person's later label
                    annotation(1, a, "2"),
                    annotation(2, b, "1"),
                ],
            }
        ]
        [p] = pairs(tasks)
        assert p.center == pytest.approx(compare(crop, a, b).center)
