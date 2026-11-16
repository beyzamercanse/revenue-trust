import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from pipeline import run


class RevenuePipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.first=run(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def test_rerun_is_idempotent_and_artifact_unchanged(self):
        before=(self.root/"dashboard"/"data.json").read_bytes()
        second=run(self.root)
        self.assertEqual(second["new_events"],0)
        self.assertEqual(before,(self.root/"dashboard"/"data.json").read_bytes())

    def test_transport_duplicates_and_versions_do_not_inflate_revenue(self):
        db=sqlite3.connect(str(self.root/"warehouse"/"revenue.sqlite"))
        unique=db.execute("SELECT COUNT(*) FROM stg_orders").fetchone()[0]
        versions=db.execute("SELECT COUNT(*) FROM raw_orders").fetchone()[0]
        self.assertGreater(versions,unique)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM stg_orders WHERE version<>2").fetchone()[0],0)
        self.assertEqual(db.execute("SELECT SUM(difference_cents) FROM mart_reconciliation").fetchone()[0],0)
        db.close()

    def test_known_invalid_refunds_are_quarantined(self):
        data=json.loads((self.root/"dashboard"/"data.json").read_text())
        self.assertEqual(data["quality_counts"]["quarantined_refunds"],3)
        self.assertEqual({x["reason"] for x in data["quarantine"]}, {"missing_order","nonpositive_amount","refund_exceeds_payment"})

    def test_late_arriving_order_revision_rebuilds_affected_history(self):
        raw=self.root/"data"/"raw"
        original=next(json.loads(x) for x in (raw/"orders.jsonl").read_text().splitlines()
                      if json.loads(x)["status"]=="paid" and json.loads(x)["version"]==2 and json.loads(x)["discount_cents"]>100)
        correction=dict(original,version=3,discount_cents=original["discount_cents"]-100)
        with (raw/"orders.jsonl").open("a") as file:
            file.write(json.dumps(correction)+"\n")
        # Separate accounting adjustment supplies independent balancing source event.
        adjustment=dict(entry_id="ADJ_TEST",entry_date=original["order_date"],order_id=original["order_id"],amount_cents=100,entry_type="sale")
        with (raw/"ledger.jsonl").open("a") as file:
            file.write(json.dumps(adjustment)+"\n")
        changed=run(self.root)
        self.assertEqual(changed["new_events"],2)
        self.assertAlmostEqual(changed["net_revenue_gbp"],self.first["net_revenue_gbp"]+1)

    def test_ledger_mismatch_blocks_publication_and_rolls_back(self):
        raw=self.root/"data"/"raw"/"ledger.jsonl"
        before=(self.root/"dashboard"/"data.json").read_bytes()
        with raw.open("a") as file:
            file.write(json.dumps(dict(entry_id="UNBALANCED",entry_date="2025-01-01",order_id="O000001",amount_cents=100,entry_type="sale"))+"\n")
        with self.assertRaisesRegex(ValueError,"Publication blocked"):
            run(self.root)
        self.assertEqual(before,(self.root/"dashboard"/"data.json").read_bytes())
        db=sqlite3.connect(str(self.root/"warehouse"/"revenue.sqlite"))
        self.assertEqual(db.execute("SELECT COUNT(*) FROM raw_ledger WHERE entry_id='UNBALANCED'").fetchone()[0],0)
        db.close()

    def test_conflicting_same_version_is_rejected(self):
        raw=self.root/"data"/"raw"/"orders.jsonl"
        record=json.loads(raw.read_text().splitlines()[0])
        record["gross_cents"]+=100
        with raw.open("a") as file:
            file.write(json.dumps(record)+"\n")
        with self.assertRaisesRegex(ValueError,"Conflicting payload"):
            run(self.root)

    def test_invalid_dates_are_rejected_before_publication(self):
        raw=self.root/"data"/"raw"/"orders.jsonl"
        before=(self.root/"dashboard"/"data.json").read_bytes()
        record=json.loads(raw.read_text().splitlines()[0])
        record.update(version=3,order_date="2025-02-30")
        with raw.open("a") as file:
            file.write(json.dumps(record)+"\n")
        with self.assertRaisesRegex(ValueError,"canonical YYYY-MM-DD"):
            run(self.root)
        self.assertEqual(before,(self.root/"dashboard"/"data.json").read_bytes())

    def test_retention_has_no_future_cohorts_and_baseline_is_one(self):
        data=json.loads((self.root/"dashboard"/"data.json").read_text())
        self.assertTrue(all(row["activity_month"] >= row["cohort"] and row["activity_month"] <= "2025-06" for row in data["cohort"]))
        self.assertTrue(all(row["retention_rate"]==1 for row in data["cohort"] if row["month_index"]==0))


if __name__=="__main__":
    unittest.main()
