import csv

from dataset.sheet_check import CALIBRATION, check, main, row_problems

ANGLES = {"00": "0", "25": "2.5", "05": "5", "10": "10"}


def row(name: str, **overrides) -> dict:
    person, kind = name.split("_")[:2]
    data = {
        "file_name": f"{name}.mov",
        "person_id": person,
        "consent_id": "CF-1",
        "age_group": "adult",
        "scan_type": kind[0],
        "target_angle_deg": ANGLES.get(kind[1:3], ""),
        "target_dir": kind[3:4],
        "usable": "yes",
    }
    return {**data, **overrides}


def complete(person: str, adult: bool = True) -> list[dict]:
    group = "adult" if adult else "child"
    rows = [row(f"{person}_N_r{i}_ip13_20261024", age_group=group) for i in (1, 2, 3)]
    rows += [row(f"{person}_{c}_r1_ip13_20261024", age_group=group) for c in sorted(CALIBRATION)]
    if adult:
        rows += [row(f"{person}_D_r{i}_ip13_20261024") for i in (1, 2)]
    return rows


def test_a_complete_session_has_no_problems():
    assert check(complete("P001") + complete("P002", adult=False)) == ([], [])


def test_row_problems():
    assert row_problems(row("P001_N_r1_ip13_20261024", consent_id="")) == [
        "P001_N_r1_ip13_20261024.mov: no consent_id"
    ]
    assert row_problems({"file_name": "IMG_0001.mov"}) == [
        "IMG_0001.mov: file name does not follow the protocol"
    ]
    assert row_problems(row("P001_N_r1_ip13_20261024", person_id="P002")) == [
        "P001_N_r1_ip13_20261024.mov: person_id does not match the file name"
    ]
    assert row_problems(row("P001_D_r1_ip13_20261024", age_group="child")) == [
        "P001_D_r1_ip13_20261024.mov: D scans are for adults only"
    ]
    assert row_problems(row("P001_C05L_r1_ip13_20261024", target_angle_deg="10")) == [
        "P001_C05L_r1_ip13_20261024.mov: target_angle_deg does not match the file name"
    ]
    assert row_problems(row("P001_C05L_r1_ip13_20261024", target_dir="R")) == [
        "P001_C05L_r1_ip13_20261024.mov: target_dir does not match the file name"
    ]


def test_missing_scans_and_duplicates():
    rows = complete("P001")
    rows = [r for r in rows if "C10R" not in r["file_name"] and "_D_r2" not in r["file_name"]]
    rows[0]["usable"] = "no"
    rows.append(dict(rows[1]))
    errors, missing = check(rows)
    assert errors == ["P001_N_r2_ip13_20261024.mov: listed more than once"]
    assert missing == ["P001: missing C10R, D x1"]


def test_children_do_not_need_deviation_scans():
    assert check(complete("P003", adult=False))[1] == []


def test_cli(tmp_path, capsys):
    path = tmp_path / "sheet.csv"
    rows = complete("P001")
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    assert main([str(path)]) == 0
    assert "Rows: 12, people: 1." in capsys.readouterr().out
    rows[0]["consent_id"] = ""
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    assert main([str(path)]) == 1
    assert "no consent_id" in capsys.readouterr().out
