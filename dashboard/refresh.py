from pathlib import Path
import json
p=Path(__file__).parent
s=(p/"data.js").read_text()
d=json.loads(s[len("const PORTFOLIO = "):].rstrip(";\n"))
d["projects"]["revenue-trust"] = json.loads((p/"data.json").read_text())
(p/"data.js").write_text("const PORTFOLIO = "+json.dumps(d)+";\n")
print("Dashboard snapshot refreshed")
