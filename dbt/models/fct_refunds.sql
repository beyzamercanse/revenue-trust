select r.refund_id, r.order_id, cast(r.refund_date as date) as refund_date,
       r.amount_cents, o.customer_id, o.channel
from {{ ref('refunds_seed') }} r
join {{ ref('fct_orders') }} o using(order_id)
