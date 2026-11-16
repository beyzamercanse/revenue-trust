DROP VIEW IF EXISTS stg_orders;
CREATE VIEW stg_orders AS
SELECT order_id, customer_id, order_date, channel, status, gross_cents, discount_cents, version
FROM (
 SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY version DESC, fingerprint DESC) AS row_rank
 FROM raw_orders
) WHERE row_rank = 1;

DROP VIEW IF EXISTS stg_refunds;
CREATE VIEW stg_refunds AS
SELECT refund_id, order_id, refund_date, amount_cents, version
FROM (
 SELECT *, ROW_NUMBER() OVER (PARTITION BY refund_id ORDER BY version DESC, fingerprint DESC) AS row_rank
 FROM raw_refunds
) WHERE row_rank = 1;

DROP TABLE IF EXISTS refund_quarantine;
CREATE TABLE refund_quarantine AS
WITH checked AS (
 SELECT r.*, o.gross_cents-o.discount_cents AS paid_cents, o.status,
  CASE WHEN o.order_id IS NULL THEN 'missing_order'
       WHEN o.status != 'paid' THEN 'order_not_paid'
       WHEN r.amount_cents <= 0 THEN 'nonpositive_amount'
       WHEN r.refund_date < o.order_date THEN 'refund_before_sale'
       WHEN r.amount_cents > o.gross_cents-o.discount_cents THEN 'refund_exceeds_payment'
       ELSE NULL END AS reason
 FROM stg_refunds r LEFT JOIN stg_orders o ON r.order_id=o.order_id
), cumulative AS (
 SELECT order_id FROM checked WHERE reason IS NULL
 GROUP BY order_id HAVING SUM(amount_cents) > MAX(paid_cents)
)
SELECT c.refund_id, c.order_id, c.amount_cents,
 COALESCE(c.reason, 'cumulative_refund_exceeds_payment') AS reason
FROM checked c WHERE c.reason IS NOT NULL OR c.order_id IN (SELECT order_id FROM cumulative);

DROP VIEW IF EXISTS fct_orders;
CREATE VIEW fct_orders AS
SELECT order_id, customer_id, order_date, channel, gross_cents, discount_cents,
       gross_cents-discount_cents AS paid_cents
FROM stg_orders WHERE status='paid';

DROP VIEW IF EXISTS fct_refunds;
CREATE VIEW fct_refunds AS
SELECT r.refund_id, r.order_id, r.refund_date, r.amount_cents, o.customer_id, o.channel
FROM stg_refunds r JOIN fct_orders o ON r.order_id=o.order_id
WHERE NOT EXISTS (SELECT 1 FROM refund_quarantine q WHERE q.refund_id=r.refund_id);
