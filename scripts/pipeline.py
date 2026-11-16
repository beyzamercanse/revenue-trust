"""Local reference implementation: append-only landing -> governed revenue marts."""
import argparse
import calendar
import csv
import hashlib
import json
import sqlite3
import sys
from pathlib import Path
from datetime import date

from generate_demo import generate

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = {
    "orders": "order_id TEXT NOT NULL, customer_id TEXT NOT NULL, order_date TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('paid','cancelled')), gross_cents INTEGER NOT NULL CHECK(gross_cents>=0), discount_cents INTEGER NOT NULL CHECK(discount_cents>=0 AND discount_cents<=gross_cents), version INTEGER NOT NULL CHECK(version>0)",
    "refunds": "refund_id TEXT NOT NULL, order_id TEXT NOT NULL, refund_date TEXT NOT NULL, amount_cents INTEGER NOT NULL, version INTEGER NOT NULL CHECK(version>0)",
    "ledger": "entry_id TEXT NOT NULL UNIQUE, entry_date TEXT NOT NULL, order_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, entry_type TEXT NOT NULL CHECK(entry_type IN ('sale','refund'))",
}
FIELDS = {
    "orders": ["order_id","customer_id","order_date","channel","status","gross_cents","discount_cents","version"],
    "refunds": ["refund_id","order_id","refund_date","amount_cents","version"],
    "ledger": ["entry_id","entry_date","order_id","amount_cents","entry_type"],
}


def rows(conn, sql):
    return [dict(row) for row in conn.execute(sql)]


def load(conn, root):
    inserted, received = 0, 0
    for source, schema in SCHEMAS.items():
        conn.execute("CREATE TABLE IF NOT EXISTS raw_%s (fingerprint TEXT PRIMARY KEY, %s)" % (source, schema))
        for line in (root / "data" / "raw" / (source + ".jsonl")).read_text().splitlines():
            if not line.strip():
                continue
            received += 1
            record = json.loads(line)
            if set(record) != set(FIELDS[source]):
                raise ValueError("Unexpected schema in " + source)
            for field, value in record.items():
                if field.endswith("_cents") or field == "version":
                    if type(value) is not int:
                        raise ValueError("Expected integer: " + field)
                elif not isinstance(value, str) or not value:
                    raise ValueError("Expected non-empty text: " + field)
                if field.endswith("_date"):
                    try:
                        parsed = date.fromisoformat(value)
                    except ValueError:
                        raise ValueError("Expected canonical YYYY-MM-DD date: " + field)
                    if parsed.isoformat() != value:
                        raise ValueError("Expected canonical YYYY-MM-DD date: " + field)
            canonical = json.dumps(record, sort_keys=True, separators=(",", ":"))
            fingerprint = hashlib.sha256(canonical.encode()).hexdigest()
            if source in ("orders", "refunds"):
                key = "order_id" if source == "orders" else "refund_id"
                conflict = conn.execute("SELECT 1 FROM raw_%s WHERE %s=? AND version=? AND fingerprint<>?" % (source,key),
                                        (record[key], record["version"], fingerprint)).fetchone()
                if conflict:
                    raise ValueError("Conflicting payload for same natural key and source version")
            columns = ["fingerprint"] + FIELDS[source]
            values = [fingerprint] + [record[field] for field in FIELDS[source]]
            before = conn.total_changes
            conn.execute("INSERT INTO raw_%s (%s) VALUES (%s) ON CONFLICT(fingerprint) DO NOTHING" %
                         (source, ",".join(columns), ",".join(["?"]*len(columns))), values)
            inserted += conn.total_changes-before
    return received, inserted


def transform(conn):
    # Statement-by-statement execution preserves the surrounding transaction.
    for filename in ["01_staging.sql", "02_marts.sql"]:
        for statement in (ROOT / "sql" / filename).read_text().split(";"):
            if statement.strip():
                conn.execute(statement)


def quality_checks(conn):
    checks = [
        ("Paid order primary key", "SELECT COUNT(*)-COUNT(DISTINCT order_id) FROM fct_orders"),
        ("Refund primary key", "SELECT COUNT(*)-COUNT(DISTINCT refund_id) FROM fct_refunds"),
        ("Refund referential integrity", "SELECT COUNT(*) FROM fct_refunds r LEFT JOIN fct_orders o USING(order_id) WHERE o.order_id IS NULL"),
        ("No negative paid amounts", "SELECT COUNT(*) FROM fct_orders WHERE paid_cents<0"),
        ("Daily ledger reconciliation", "SELECT COUNT(*) FROM mart_reconciliation WHERE difference_cents<>0"),
        ("Cohort bounds", "SELECT COUNT(*) FROM mart_cohorts WHERE retention_rate<0 OR retention_rate>1"),
    ]
    return [{"name": name, "failures": conn.execute(sql).fetchone()[0], "status": "pass" if conn.execute(sql).fetchone()[0]==0 else "fail"}
            for name, sql in checks]


def export(conn, root):
    monthly = rows(conn, """SELECT substr(day,1,7) AS month, ROUND(SUM(gross_cents)/100.0,2) AS gross_revenue,
        ROUND(SUM(discount_cents)/100.0,2) AS discounts, ROUND(SUM(refund_cents)/100.0,2) AS refunds,
        ROUND(SUM(net_cents)/100.0,2) AS net_revenue, SUM(orders) AS orders
        FROM mart_daily_revenue GROUP BY month ORDER BY month""")
    channels = rows(conn, """SELECT channel, SUM(net_cents)/100.0 AS net_revenue, SUM(orders) AS orders,
        SUM(refund_cents)/100.0 AS refunds FROM mart_daily_revenue GROUP BY channel ORDER BY net_revenue DESC""")
    monthly_channels = rows(conn, """SELECT substr(day,1,7) AS month, channel, SUM(net_cents)/100.0 AS net_revenue,
        SUM(orders) AS orders, SUM(refund_cents)/100.0 AS refunds FROM mart_daily_revenue GROUP BY month,channel ORDER BY month,channel""")
    quality = quality_checks(conn)
    quarantine = rows(conn, "SELECT reason, COUNT(*) AS rows FROM refund_quarantine GROUP BY reason ORDER BY reason")
    net = round(sum(x["net_revenue"] for x in monthly),2)
    order_count = sum(x["orders"] for x in monthly)
    refunds = round(sum(x["refunds"] for x in monthly),2)
    paid = sum(x["gross_revenue"]-x["discounts"] for x in monthly)
    may, june = monthly[-2:]
    monthly_delta = round((june["net_revenue"]/may["net_revenue"]-1)*100,2)
    may_days = calendar.monthrange(*map(int,may["month"].split("-")))[1]
    june_days = calendar.monthrange(*map(int,june["month"].split("-")))[1]
    daily_delta = round(((june["net_revenue"]/june_days)/(may["net_revenue"]/may_days)-1)*100,2)
    may_paid = may["gross_revenue"]-may["discounts"]
    june_paid = june["gross_revenue"]-june["discounts"]
    drivers = [
        {"driver":"Paid order volume", "amount":round((june["orders"]-may["orders"])*may_paid/may["orders"],2)},
        {"driver":"Average paid order value", "amount":round((june_paid/june["orders"]-may_paid/may["orders"])*june["orders"],2)},
        {"driver":"Refund postings", "amount":round(may["refunds"]-june["refunds"],2)},
    ]
    quality_counts = {
        "unique_order_versions": conn.execute("SELECT COUNT(*) FROM raw_orders").fetchone()[0],
        "current_orders": conn.execute("SELECT COUNT(*) FROM stg_orders").fetchone()[0],
        "accepted_refunds": conn.execute("SELECT COUNT(*) FROM fct_refunds").fetchone()[0],
        "quarantined_refunds": conn.execute("SELECT COUNT(*) FROM refund_quarantine").fetchone()[0],
        "reconciled_days": conn.execute("SELECT COUNT(*) FROM mart_reconciliation WHERE difference_cents=0").fetchone()[0],
    }
    payload = {
        "project": "revenue-trust", "title": "Revenue Trust", "currency": "GBP",
        "provenance": {"type":"synthetic", "label":"Deterministic fictional commerce scenario; not a real company", "seed":41,
                       "period_start":"2025-01-01", "period_end":"2025-06-30", "generated_by":"scripts/generate_demo.py"},
        "metrics": [
            {"label":"Net revenue", "value":net, "format":"currency"},
            {"label":"Paid orders", "value":order_count, "format":"integer"},
            {"label":"Refund amount / paid sales", "value":round(100*refunds/paid,2), "format":"percent"},
            {"label":"Daily ledger match", "value":100.0, "format":"percent"},
        ],
        "monthly": monthly, "channels": channels, "monthly_channels": monthly_channels,
        "drivers": drivers,
        "cohort": rows(conn, "SELECT * FROM mart_cohorts ORDER BY cohort,month_index"),
        "quality": quality, "quality_counts":quality_counts, "quarantine":quarantine,
        "reconciliation": rows(conn, "SELECT day,model_cents/100.0 AS model_amount,ledger_cents/100.0 AS ledger_amount,difference_cents/100.0 AS difference FROM mart_reconciliation ORDER BY day"),
        "findings": [
            "%s net revenue changed by %+.2f%% versus %s; the calendar-adjusted daily change was %+.2f%%." % (june["month"],monthly_delta,may["month"],daily_delta),
            "%d invalid refund records were quarantined before publication." % quality_counts["quarantined_refunds"],
            "All %d modeled days reconcile to the fictional ledger at integer-pence precision." % quality_counts["reconciled_days"],
        ],
        "limitations": ["No cost-of-goods data: net revenue is not profit.", "No traffic or exposure data: cancelled-order share is not website conversion.",
                        "Refund rate uses refund posting date, so it is a period amount ratio, not an order-level refund probability.",
                        "Ledger and operational fixtures are generated together; reconciliation proves implementation consistency, not independent financial assurance."]
    }
    (root / "dashboard").mkdir(parents=True, exist_ok=True)
    (root / "dashboard" / "data.json").write_text(json.dumps(payload, indent=2) + "\n")
    seeds = root / "dbt" / "seeds"
    seeds.mkdir(parents=True, exist_ok=True)
    for name, query in [
        ("orders_seed", "SELECT * FROM stg_orders ORDER BY order_id"),
        ("refunds_seed", "SELECT r.* FROM stg_refunds r WHERE NOT EXISTS (SELECT 1 FROM refund_quarantine q WHERE q.refund_id=r.refund_id) ORDER BY refund_id"),
        ("ledger_seed", "SELECT entry_id,entry_date,order_id,amount_cents,entry_type FROM raw_ledger ORDER BY entry_id"),
    ]:
        records = rows(conn, query)
        with (seeds/(name+".csv")).open("w", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=list(records[0]))
            writer.writeheader()
            writer.writerows(records)
    return payload


def run(root=ROOT, regenerate=False):
    root = Path(root)
    if regenerate or not (root/"data"/"raw"/"orders.jsonl").exists():
        generate(root)
    (root/"warehouse").mkdir(parents=True,exist_ok=True)
    conn = sqlite3.connect(str(root/"warehouse"/"revenue.sqlite"))
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            received, inserted = load(conn, root)
            transform(conn)
            checks = quality_checks(conn)
            failed = [check["name"] for check in checks if check["failures"]]
            if failed:
                raise ValueError("Publication blocked: " + ", ".join(failed))
        payload = export(conn, root)
        result = {"received_events":received,"new_events":inserted,"quality_checks_passed":len(checks),
                  "net_revenue_gbp":payload["metrics"][0]["value"],"paid_orders":payload["metrics"][1]["value"],
                  "quarantined_refunds":payload["quality_counts"]["quarantined_refunds"]}
        return result
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--regenerate",action="store_true",help="Recreate the deterministic source fixture")
    args = parser.parse_args()
    print(json.dumps(run(regenerate=args.regenerate),indent=2))
