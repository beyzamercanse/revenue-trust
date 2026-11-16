# Optional dbt / DuckDB transformation port

This is executable source for a dbt Core 1.x + `dbt-duckdb` extension. The standard-library reference pipeline is independently runnable. It exports canonical, validated records to `seeds/`; dbt creates four modeled tables and checks their keys, refund bounds, and ledger reconciliation.

From repository root:

```sh
python3 scripts/pipeline.py
python3 -m venv .venv
.venv/bin/python -m pip install -r dbt/requirements.txt
cd dbt
../.venv/bin/dbt build --profiles-dir .
../.venv/bin/dbt docs generate --profiles-dir .
../.venv/bin/dbt docs serve --profiles-dir .
```

Verified locally on 16 November 2026: dbt Core 1.10.23, dbt-duckdb 1.10.0 and DuckDB 1.4.5; three seeds, four table models and ten data tests completed successfully. `dbt docs generate` also completed. The exact build summary is in `../docs/dbt-verification.json`. These versions reproduce the local Python 3.9 verification environment; dbt emitted a deprecation notice for this Core line, so evaluate a supported release and rerun these checks before production use. This port uses table materializations; it does not claim incremental dbt modeling, production orchestration, or a deployed semantic layer. Landing deduplication, version handling, and quarantine remain in the Python reference implementation.

Primary references: [DuckDB connection documentation](https://docs.getdbt.com/docs/local/connect-data-platform/duckdb-setup), [dbt data tests](https://docs.getdbt.com/reference/resource-properties/data-tests), [dbt-duckdb adapter](https://github.com/duckdb/dbt-duckdb). dbt's current default documentation may show v2; these project commands deliberately target the Python-based 1.x adapter.
