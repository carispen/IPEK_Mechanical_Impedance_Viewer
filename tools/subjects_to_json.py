# Convert the subject overview workbook into data/subjects.json, keyed by SubjectNumber.
# Values are copied exactly as entered in the workbook (measurement data: no rounding or cleaning).
# Usage: python tools/subjects_to_json.py [workbook.xlsx]
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "260417_Probandenübersicht.xlsx"
OUT = ROOT / "data" / "subjects.json"

# Workbook column (English header, row 1) -> JSON field. Field names match the resultsMatrix files.
COLUMNS = {
    "Gender": None,  # "m"/"w"; the numeric "Gender Array" column next to it is used instead
    "Age in years": "age",
    "Body Height in mm": "bodyHeight",
    "Front Reach; Handle-axis in mm": "FrontReach",
    "Elbow-To-Wrist Length in mm": "ElbowToWristLength",
    "Thumb Length in mm": "thumbLength",
    "Hand length in mm": "handLength",
    "Palm Length in mm": "palmLength",
    "Hand Width at the Metacarpals in mm": "palmWidth",
    "Body Weight in kg": "bodyWeight",
    "Hand Weight in g": "handWeight",
    "Forearm Circumference in mm": "forearmCircumference",
    "Arm Circumference in mm": "armCircumference",
}

ws = openpyxl.load_workbook(SRC, data_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
header = [str(h).strip() if h is not None else None for h in rows[0]]

# Fail loudly if columns were moved or renamed instead of reading the wrong values
col = {name: header.index(name) for name in COLUMNS}
gender_col = col["Gender"] + 1
assert str(rows[1][gender_col]).strip() == "Gender Array", "expected 'Gender Array' right of 'Gender'"

subjects = {}
for r in rows[2:]:
    if r[0] is None:
        continue
    s = {"gender": r[gender_col]}  # 1 = male, 2 = female
    assert {"m": 1, "w": 2}[r[col["Gender"]]] == s["gender"], f"gender mismatch for subject {r[0]}"
    s.update({field: r[col[name]] for name, field in COLUMNS.items() if field})
    subjects[str(r[0])] = s

OUT.write_text(json.dumps({"source": SRC.name, "subjects": subjects}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"{len(subjects)} subjects -> {OUT.relative_to(ROOT)}")
