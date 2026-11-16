# Revenue Trust — executive case study

**Decision:** prioritize investigation of the mobile paid-order decline and refund increase before increasing acquisition spend.

**Status:** reproducible portfolio simulation. The following findings are measured from the generated fixture, not a real company's performance. No commercial impact is claimed.

## What happened?

June net revenue was **£90,290.90**, compared with **£102,564.44** in May: a **£12,273.54 decline (11.97%)**. Because June has one fewer day, the decline in net revenue per calendar day was **9.03%**. The available data contains orders, refunds, and ledger entries; it does not contain site traffic, marketing spend, customer support contacts, or product costs.

| Arithmetic contributor | Contribution to June minus May net revenue |
|---|---:|
| Paid-order volume: 1,181 → 1,077 | −£9,303.97 |
| Average paid order value | +£489.57 |
| Refund postings: £3,089.28 → £6,548.42 | −£3,459.14 |
| **Total** | **−£12,273.54** |

These are arithmetic contributions, not causal estimates. The volume-first bridge uses May's average paid order value and assigns its interaction term to the average-value component.

## Where is it concentrated?

Mobile net revenue fell from **£26,640.63 to £15,372.06**, a **£11,268.57** decline. Mobile paid orders fell from **302 to 214** and its refund postings rose from **£934.53 to £3,333.07**. Web revenue also declined, while Marketplace partially offset the loss. Mobile is therefore the first investigation target, not proof of a diagnosed real-world cause. The fictional generator intentionally includes a mobile disruption so the exercise has an explainable reference scenario.

## Can the numbers be trusted?

The model reduced **15,248 delivered source events** to **14,770 unique source records**, selected the latest version of each of **7,089 orders**, and counted **6,688 paid orders**. It accepted **413 refunds** and quarantined **3 invalid refund records**. Modeled net revenue matched the fictional ledger on **all 181 observed dates** at integer-pence precision. Eight automated tests validate reruns, revisions, conflicts, malformed dates, invalid refunds, retention boundaries, and failed-ledger rollback.

The ledger is generated from the same simulated business process. A real deployment would reconcile to a genuinely independent, Finance-approved accounting source.

## Recommended actions and how to measure them

1. **Investigate mobile payment and checkout failures.** Join payment attempt and release logs before proposing a fix. Measure paid completion per eligible payment attempt, segmented by device and payment method. This denominator is absent from the current dataset.
2. **Trace mobile refund reasons and affected products.** Join reason codes and customer-service records; separate product returns from duplicate charges and payment reversals. Evaluate the order-cohort refund probability only after a complete observation window.
3. **Protect the revenue reporting contract.** Keep source-version handling and ledger reconciliation as publication gates. Route unresolved refunds to an owner, track their age, and document historical restatements when late corrections arrive.

Success criteria are proposed measurements. A real intervention's causal effect would need a valid experiment or an appropriately justified observational design. This portfolio does not claim that the recommendations increased revenue.

## Five-minute presentation outline

1. Business question and precise net revenue definition.
2. May–June trend, calendar-day adjustment, and the arithmetic bridge.
3. Channel evidence and the limits of causal interpretation.
4. Architecture, quarantine, reconciliation, and a failing-ledger demonstration.
5. Prioritized next actions, measurement plan, and production tradeoffs.
