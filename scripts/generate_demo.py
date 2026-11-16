"""Deterministic, entirely fictional transaction and ledger source systems."""
import json
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def generate(root=ROOT):
    rng = random.Random(41)
    orders, refunds, ledger = [], [], []
    start, end = date(2025, 1, 1), date(2025, 6, 30)
    order_no = 0
    for day_index in range((end - start).days + 1):
        day = start + timedelta(days=day_index)
        count = 38 + rng.randint(-8, 10)
        for _ in range(count):
            order_no += 1
            channel = rng.choice(["Web", "Web", "Mobile", "Marketplace"])
            # Explicit scenario: a mobile checkout issue reduces paid order volume in June.
            cancelled = rng.random() < (0.25 if day.month == 6 and channel == "Mobile" else 0.045)
            gross = rng.randint(1800, 17000)
            discount = round(gross * rng.choice([0, 0, .05, .10]))
            oid = "O%06d" % order_no
            order = dict(order_id=oid, customer_id="C%04d" % rng.randint(1, 950),
                         order_date=day.isoformat(), channel=channel,
                         status="cancelled" if cancelled else "paid",
                         gross_cents=gross, discount_cents=discount, version=2)
            if order_no % 43 == 0:
                orders.append(dict(order, discount_cents=0, version=1))
            orders.append(order)
            if order_no % 17 == 0:
                orders.append(dict(order))  # transport duplicate
            if cancelled:
                continue
            ledger.append(dict(entry_id="L" + oid, entry_date=day.isoformat(),
                               order_id=oid, amount_cents=gross-discount, entry_type="sale"))
            refund_probability = .22 if day.month == 6 and channel == "Mobile" else .055
            if rng.random() < refund_probability:
                refund_day = day + timedelta(days=rng.randint(0, 9))
                if refund_day > end:
                    continue  # source only contains events known as of the cutoff
                amount = round((gross-discount) * rng.choice([.5, 1]))
                rid = "R" + oid
                refund = dict(refund_id=rid, order_id=oid, refund_date=refund_day.isoformat(),
                              amount_cents=amount, version=1)
                refunds.append(refund)
                if order_no % 7 == 0:
                    refunds.append(dict(refund))
                ledger.append(dict(entry_id="L" + rid, entry_date=refund_day.isoformat(),
                                   order_id=oid, amount_cents=-amount, entry_type="refund"))
    # Known faults: these never appear in the independently supplied ledger.
    refunds.extend([
        dict(refund_id="R_BAD_ORPHAN", order_id="O_DOES_NOT_EXIST", refund_date="2025-06-15", amount_cents=500, version=1),
        dict(refund_id="R_BAD_NEGATIVE", order_id="O000001", refund_date="2025-06-15", amount_cents=-500, version=1),
        dict(refund_id="R_BAD_OVERPAY", order_id="O000001", refund_date="2025-06-15", amount_cents=999999, version=1),
    ])
    raw = root / "data" / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    for name, records in [("orders", orders), ("refunds", refunds), ("ledger", ledger)]:
        # Deliberately shuffled delivery order tests version selection.
        rng.shuffle(records)
        with (raw / (name + ".jsonl")).open("w") as file:
            for record in records:
                file.write(json.dumps(record, sort_keys=True) + "\n")
    return {"order_events": len(orders), "refund_events": len(refunds), "ledger_entries": len(ledger)}


if __name__ == "__main__":
    print(json.dumps(generate(), indent=2))
