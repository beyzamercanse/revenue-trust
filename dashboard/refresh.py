"""Rebuild dashboard/data.js from the pipeline output so index.html also works offline (file://)."""
import json
from pathlib import Path

here = Path(__file__).resolve().parent
data = json.loads((here / "data.json").read_text())
extra = here / "robustness.json"
if extra.exists():
    data["robustness"] = json.loads(extra.read_text())
(here / "data.js").write_text("window.PROJECT_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
print("dashboard/data.js refreshed")
