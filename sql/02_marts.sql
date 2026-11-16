DROP TABLE IF EXISTS mart_daily_revenue;
CREATE TABLE mart_daily_revenue AS
WITH events AS (
 SELECT order_date AS day, channel, gross_cents, discount_cents, 0 AS refund_cents, 1 AS orders
 FROM fct_orders
 UNION ALL
 SELECT refund_date, channel, 0, 0, amount_cents, 0 FROM fct_refunds
)
SELECT day, channel, SUM(gross_cents) AS gross_cents, SUM(discount_cents) AS discount_cents,
 SUM(refund_cents) AS refund_cents,
 SUM(gross_cents-discount_cents-refund_cents) AS net_cents, SUM(orders) AS orders
FROM events GROUP BY day, channel;

DROP TABLE IF EXISTS mart_reconciliation;
CREATE TABLE mart_reconciliation AS
WITH modeled AS (SELECT day, SUM(net_cents) AS model_cents FROM mart_daily_revenue GROUP BY day),
ledger AS (SELECT entry_date AS day, SUM(amount_cents) AS ledger_cents FROM raw_ledger GROUP BY entry_date),
dates AS (SELECT day FROM modeled UNION SELECT day FROM ledger)
SELECT d.day, COALESCE(m.model_cents,0) AS model_cents, COALESCE(l.ledger_cents,0) AS ledger_cents,
 COALESCE(m.model_cents,0)-COALESCE(l.ledger_cents,0) AS difference_cents
FROM dates d LEFT JOIN modeled m ON d.day=m.day LEFT JOIN ledger l ON d.day=l.day;

DROP TABLE IF EXISTS mart_cohorts;
CREATE TABLE mart_cohorts AS
WITH first_order AS (
 SELECT customer_id, MIN(substr(order_date,1,7)) AS cohort FROM fct_orders GROUP BY customer_id
), activity AS (
 SELECT DISTINCT customer_id, substr(order_date,1,7) AS activity_month FROM fct_orders
), sizes AS (SELECT cohort, COUNT(*) AS cohort_size FROM first_order GROUP BY cohort),
months AS (SELECT DISTINCT substr(day,1,7) AS month FROM mart_daily_revenue),
grid AS (
 SELECT s.cohort, m.month AS activity_month, s.cohort_size
 FROM sizes s CROSS JOIN months m WHERE m.month >= s.cohort
)
SELECT g.cohort, g.activity_month,
 (CAST(substr(g.activity_month,1,4) AS INTEGER)-CAST(substr(g.cohort,1,4) AS INTEGER))*12+
 CAST(substr(g.activity_month,6,2) AS INTEGER)-CAST(substr(g.cohort,6,2) AS INTEGER) AS month_index,
 g.cohort_size AS eligible_customers, COUNT(DISTINCT a.customer_id) AS active_customers,
 ROUND(1.0*COUNT(DISTINCT a.customer_id)/g.cohort_size,4) AS retention_rate
FROM grid g LEFT JOIN first_order f ON f.cohort=g.cohort
LEFT JOIN activity a ON a.customer_id=f.customer_id AND a.activity_month=g.activity_month
GROUP BY g.cohort,g.activity_month,g.cohort_size;

-- Month x channel grain for the channel bridge (scripts/bridge.py).
DROP TABLE IF EXISTS mart_month_channel;
CREATE TABLE mart_month_channel AS
SELECT substr(day,1,7) AS month, channel, SUM(orders) AS orders,
 SUM(gross_cents-discount_cents) AS paid_cents, SUM(refund_cents) AS refund_cents,
 SUM(net_cents) AS net_cents
FROM mart_daily_revenue GROUP BY substr(day,1,7), channel;
