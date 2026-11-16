select order_id, customer_id, cast(order_date as date) as order_date, channel,
       gross_cents, discount_cents, gross_cents-discount_cents as paid_cents
from {{ ref('orders_seed') }}
where status='paid'
