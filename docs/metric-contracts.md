# Metric definitions and data contracts

All financial calculations use integer pence until display. The fixture uses GBP only. Dates are ISO `YYYY-MM-DD`; the simulation has no time-of-day or timezone ambiguity. A real source must declare its timestamp timezone and business-day boundary before ingestion.

| Metric | Exact definition | Important exclusions / interpretation |
|---|---|---|
| Gross revenue | Sum of `gross_cents` on paid orders, by order date | Cancelled orders excluded; taxes and shipping absent from the simulation |
| Discounts | Sum of paid-order `discount_cents`, by order date | A source correction can restate historical order-date amounts |
| Paid sales | Gross revenue minus discounts | Merchandise amount before refunds |
| Refunds | Sum of accepted refund amounts, by refund posting date | May refer to orders from earlier periods; quarantined events excluded |
| Net revenue | Gross revenue minus discounts minus accepted refunds | Not profit and not a full accounting revenue-recognition policy |
| Paid orders | Count of unique current orders with `status='paid'`, by order date | Refunded orders remain paid orders; no session conversion inference |
| Refund amount ratio | Period refund postings / period paid sales | Amount-weighted period ratio, not share of orders ultimately refunded |
| Average paid order value | Paid sales / paid orders | Does not deduct refunds, avoiding an inconsistent order-date denominator |
| Monthly repeat-purchase retention | Distinct cohort customers with ≥1 paid order in activity month / original cohort size | First observed paid purchase defines cohort; observed history may be left-censored in real data |
| Daily ledger match | Modeled net revenue equals signed ledger postings on every observed date | Fixture consistency test; not independent financial assurance |

Calendar-normalized comparison divides each complete month by its actual number of calendar days. This corrects exposure length, not seasonality, weekday mix, channel mix, or causal confounding.

## Revenue change decomposition

For prior period 0 and current period 1, let `N` be paid-order count, `A` average paid order value, and `R` refund postings. Then:

```text
net = N × A − R
volume effect = (N1 − N0) × A0
average-value effect = N1 × (A1 − A0)
refund effect = −(R1 − R0)
sum of effects = net1 − net0
```

This is an exact, ordered arithmetic bridge before display rounding. It is descriptive, not a causal attribution; changing the decomposition order changes how interaction effects are allocated. The dashboard compares the last two complete months of this fixed Jan–Jun 2025 demo.

## API artifact contract

`dashboard/data.json` is generated only after quality checks pass. Monetary fields in JSON use GBP display units, while the SQLite source of truth uses pence. It includes monthly and monthly-channel aggregates, overall channel totals, monthly cohort observations, quality results, quarantine reasons, the full daily reconciliation series, source provenance, and interpretation limits. The static dashboard does not issue database queries or expose raw customer-level records.

## Source limitations

All sources use a fixed seed and are fictional. The source generator creates both operational records and the corresponding ledger: reconciliation proves code consistency, not independence between real systems. The six-month fixture includes deliberate duplicate delivery, older versions, a mobile revenue disruption scenario, and three invalid refunds. It is useful for demonstrating contracts and failures; it cannot establish a real market finding or business outcome.
