# Revenue Trust

**A revenue data product that explains a sales decline and proves the numbers reconcile.**

Primary fit: **Analytics Engineer**. Secondary fit: Data Analyst and Data Engineer.

Business question: *Why did June net revenue fall, which channel deserves investigation, and can Finance trust the answer?*

This repository is a working local reference implementation with an entirely **synthetic**, reproducible commerce dataset. Its outputs are portfolio demonstration results, not a real employer's revenue, a client engagement, or claimed business impact.

## Open the evidence

- [Architecture and operating design](docs/architecture.md)
- [Executive case study and recommendations](docs/case-study.md)
- [Metric definitions and data contracts](docs/metric-contracts.md)
- [Dashboard data and integration contract](dashboard/README.md)
- [Optional dbt / DuckDB port](dbt/README.md)
- [Meaningful failure and recovery tests](tests/test_pipeline.py)

## Run in one minute

Requires Python 3.9+ with the standard library; no credentials, paid cloud, package installation, or internet access is needed for the baseline.

```sh
python3 scripts/pipeline.py
python3 -m unittest discover -s tests -v
python3 scripts/pipeline.py
```

The first run generates raw JSONL fixtures, lands unique source events in `warehouse/revenue.sqlite`, runs SQL models and quality gates, exports `dashboard/data.json`, and creates seeds for the optional dbt port. The final command should report `new_events: 0`. Changing or corrupting the ledger should block publication instead of producing a plausible-looking dashboard.

The fixture covers 1 January–30 June 2025: 15,248 delivered events, 14,770 unique source records, 7,089 current orders, and 6,688 paid orders. The verified output contains **£577,067.86 net revenue**, **3 quarantined invalid refunds**, and **181 daily ledger matches**. A duplicate delivery or an older source version cannot inflate revenue. A late corrected version updates historical results; a ledger discrepancy rolls back the transaction and preserves the last published JSON.

## What makes this interview-worthy

1. A real business decision drives the model: investigate mobile revenue loss, with a decomposition of volume, paid order value, and refunds.
2. Definitions are explicit: paid orders differ from website conversion; net revenue differs from profit; refunds belong to their posting dates.
3. Data contracts handle integer money, duplicates, out-of-order versions, orphan refunds, excess refunds, and malformed dates.
4. The dashboard is downstream of reconciliation and quality gates. A failed financial check prevents publication.
5. Tests exercise the operating risks: reruns, late changes, conflicting versions, invalid dates, and rollback.

## Implemented versus proposed

| Implemented and verified | Automation configuration | Production extension design |
|---|---|---|
| Python ingestion; SQLite SQL marts; append-only event landing; quarantine; reconciliation; JSON export; eight automated tests; executed dbt/DuckDB port with four models and ten passing data tests | GitHub Actions CI configuration | BigQuery partitioned warehouse; managed ingestion; Dagster orchestration; dbt deployment; service accounts; alert routing; BI semantic definitions |

The baseline incrementally **lands** new source versions, then fully rebuilds the small local marts. It does not claim incremental warehouse transformations, streaming, production scheduling, or a deployed cloud stack. The optional dbt port uses full table materializations.

## CV wording you can defend after reproducing and explaining it

> Built a reproducible commerce revenue pipeline in Python and SQL, deduplicating 15,248 delivered events, quarantining invalid refunds, and reconciling modeled revenue to 181 daily ledger totals; verified idempotent reruns and late corrections with automated tests.

Analyst variation:

> Investigated an 11.97% month-on-month revenue decline in a simulated commerce dataset, decomposing the change into order volume, average paid order value, and refund effects, and delivering a decision-focused dashboard with documented metric definitions.

Do not describe the simulated revenue as money earned, savings delivered, or a real commercial result. Add dbt, cloud, orchestration, or BI tooling to your CV only after personally running and explaining that extension.

## Interview walkthrough

Start with the business question and the June driver chart. Explain why comparing calendar months requires daily normalization. Show a raw transport duplicate, then the window function selecting the newest order version. Run the late-correction test and the failed-ledger test. End with the tradeoff: a cheap, deterministic reference implementation now; partition-aware warehouse processing when real volume and operating requirements justify it.

## Suggested next milestones

- Reproduce the verified dbt port, inspect its generated lineage and add an independently written model.
- Replace fictional sources with a permissioned orders/refunds/ledger extract. Do not claim that an e-commerce orders-only dataset supplies accounting ground truth.
- Add source freshness SLAs, incremental partition rebuilds, and orchestration failure alerts only after the source update contract is settled.
- Implement the same certified measures in the BI tool your target job uses; validate the BI totals against `mart_reconciliation`.

All fixture data is generated locally. The code is supplied under the [MIT license](LICENSE); generated fictional data is included in the same grant.

## Interactive dashboard and portfolio

[Open the portfolio dashboard](https://beyza-data-portfolio.dewyisle36.chatgpt.site/#revenue-trust/dashboard) · [Project case study](https://beyza-data-portfolio.dewyisle36.chatgpt.site/#revenue-trust)

The hosted portfolio initially requires owner access. The self-contained local dashboard is available without hosting: open `dashboard/index.html`. After rerunning the data pipeline, run `python3 dashboard/refresh.py` to refresh its browser snapshot. All default dashboard figures are synthetic and generated by the pipeline.

AI assisted the initial code and documentation. Before using this project in applications, reproduce it, review its definitions and add an independently understood extension.
