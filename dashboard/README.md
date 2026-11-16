# Dashboard integration

`data.json` is an actual export from the local pipeline. It is safe to render as a static dashboard and contains fictional aggregates only.

- `metrics`: KPI cards with `label`, `value`, and `format` (`currency`, `integer`, `percent`). Percent values already use 0–100 units.
- `monthly`: six rows with `month`, `gross_revenue`, `discounts`, `refunds`, `net_revenue`, and `orders`.
- `channels`: overall channel totals; `monthly_channels`: channel × month totals. Filtering should recompute cards from matching aggregates rather than retaining unfiltered totals.
- `drivers`: the final two months' descriptive net revenue bridge. This bridge is overall and must not be shown as channel-filtered evidence.
- `cohort`: `cohort`, `activity_month`, `month_index`, `eligible_customers`, `active_customers`, `retention_rate`. Rates here use 0–1 units. Absent future cells are unobserved, not zero.
- `channel_bridge`: May→June change per channel, split into `calendar`, `volume`, `order_value` and `refunds` (GBP). Each row's parts sum exactly to `total`; the rows sum to the overall change. Built in integer pence by `scripts/bridge.py`.
- `quality`: seven assertions; `quality_counts`: processing and reconciliation counts; `quarantine`: rejected row counts by reason.
- `reconciliation`: one row per date with modeled, ledger, and difference amounts.
- `provenance`, `findings`, and `limitations`: data source, findings and caveats shown on the dashboard.

Recommended dashboard views: executive overview, revenue drivers, monthly cohort matrix, and data reliability. Always show the synthetic-data disclosure and the fixed Jan–Jun 2025 date range. A static export is not a live production connection.
