with modeled as (
 select day, sum(net_cents) as model_cents from {{ ref('mart_daily_revenue') }} group by day
), ledger as (
 select cast(entry_date as date) as day, sum(amount_cents) as ledger_cents
 from {{ ref('ledger_seed') }} group by day
)
select coalesce(m.day,l.day) as day, coalesce(m.model_cents,0) as model_cents,
       coalesce(l.ledger_cents,0) as ledger_cents,
       coalesce(m.model_cents,0)-coalesce(l.ledger_cents,0) as difference_cents
from modeled m full outer join ledger l using(day)
