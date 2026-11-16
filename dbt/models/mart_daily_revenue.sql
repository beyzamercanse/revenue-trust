with events as (
 select order_date as day, channel, gross_cents, discount_cents, 0 as refund_cents, 1 as orders
 from {{ ref('fct_orders') }}
 union all
 select refund_date, channel, 0, 0, amount_cents, 0 from {{ ref('fct_refunds') }}
)
select day, channel, sum(gross_cents) as gross_cents, sum(discount_cents) as discount_cents,
       sum(refund_cents) as refund_cents,
       sum(gross_cents-discount_cents-refund_cents) as net_cents, sum(orders) as orders
from events group by day,channel
