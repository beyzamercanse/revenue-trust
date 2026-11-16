import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from bridge import channel_bridge
from pipeline import run


def row(month, channel, orders, paid, refunds):
    return {"month": month, "channel": channel, "orders": orders, "paid_cents": paid,
            "refund_cents": refunds, "net_cents": paid - refunds}


class BridgeArithmeticTests(unittest.TestCase):
    def test_components_balance_exactly_per_channel_and_in_total(self):
        rows = [row("2025-05", "Web", 310, 1_550_000, 20_000), row("2025-06", "Web", 290, 1_480_000, 35_000),
                row("2025-05", "Mobile", 155, 700_003, 9_000), row("2025-06", "Mobile", 101, 451_117, 40_001)]
        bridge = channel_bridge(rows, "2025-05", "2025-06")
        for r in bridge["channels"]:
            parts = r["calendar_cents"] + r["volume_cents"] + r["order_value_cents"] + r["refunds_cents"]
            self.assertEqual(parts, r["total_cents"])
            self.assertIsInstance(r["order_value_cents"], int)
        total = sum(r["total_cents"] for r in bridge["channels"])
        self.assertEqual(total, bridge["total"]["compare_net_cents"] - bridge["total"]["base_net_cents"])

    def test_equal_month_lengths_have_no_calendar_effect(self):
        rows = [row("2025-03", "Web", 100, 500_000, 0), row("2025-05", "Web", 110, 560_000, 0)]
        bridge = channel_bridge(rows, "2025-03", "2025-05")
        web = bridge["channels"][0]
        self.assertEqual(web["calendar_cents"], 0)
        self.assertEqual(web["volume_cents"], 50_000)  # 10 extra orders at the £50 base value
        self.assertEqual(web["order_value_cents"], 10_000)

    def test_new_channel_and_largest_decline_first(self):
        rows = [row("2025-05", "Web", 100, 500_000, 0), row("2025-06", "Web", 50, 250_000, 0),
                row("2025-06", "Kiosk", 5, 12_000, 0)]
        bridge = channel_bridge(rows, "2025-05", "2025-06")
        self.assertEqual(bridge["channels"][0]["channel"], "Web")
        kiosk = next(r for r in bridge["channels"] if r["channel"] == "Kiosk")
        self.assertEqual((kiosk["volume_cents"], kiosk["calendar_cents"], kiosk["order_value_cents"]), (12_000, 0, 0))


class BridgeOnFixtureTests(unittest.TestCase):
    def test_published_bridge_points_at_mobile_and_reconciles(self):
        with tempfile.TemporaryDirectory() as temp:
            run(Path(temp))
            data = json.loads((Path(temp) / "dashboard" / "data.json").read_text())
        bridge = data["channel_bridge"]
        self.assertEqual(bridge["channels"][0]["channel"], "Mobile")
        monthly = {m["month"]: m["net_revenue"] for m in data["monthly"]}
        self.assertAlmostEqual(bridge["total"]["total"], monthly["2025-06"] - monthly["2025-05"], places=2)
        self.assertTrue(all(q["status"] == "pass" for q in data["quality"]))


if __name__ == "__main__":
    unittest.main()
