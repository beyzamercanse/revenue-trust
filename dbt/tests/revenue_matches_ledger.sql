select * from {{ ref('mart_reconciliation') }} where difference_cents <> 0
