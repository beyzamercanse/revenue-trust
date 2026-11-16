select r.order_id
from {{ ref('fct_refunds') }} r join {{ ref('fct_orders') }} o using(order_id)
group by r.order_id
having sum(r.amount_cents) > max(o.paid_cents) or min(r.amount_cents) <= 0
