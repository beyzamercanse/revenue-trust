"""Channel revenue bridge between two months, in integer pence.

The month-level drivers say *how* net revenue fell (fewer orders, more
refunds). This bridge says *where*: each channel's change is split into

  calendar      the month simply has fewer (or more) days, at the base run-rate
  volume        paid orders above/below the base daily run-rate
  order value   change in average paid order value (residual of paid sales)
  refunds       change in refund postings (more refunds = negative)

Order value is computed as the residual, so every channel's components add up
to its net revenue change exactly, and the channels add up to the total. If
they do not, the bridge raises instead of publishing an unbalanced chart.
"""
import calendar


def _days(month):
    year, mon = map(int, month.split('-'))
    return calendar.monthrange(year, mon)[1]


def channel_bridge(rows, base_month, compare_month):
    """rows: dicts with month, channel, orders, paid_cents, refund_cents, net_cents."""
    empty = {'orders': 0, 'paid_cents': 0, 'refund_cents': 0, 'net_cents': 0}
    by_key = {(r['month'], r['channel']): r for r in rows}
    channels = sorted({r['channel'] for r in rows if r['month'] in (base_month, compare_month)})
    base_days, compare_days = _days(base_month), _days(compare_month)
    scale = compare_days / base_days
    result = []
    for channel in channels:
        b = by_key.get((base_month, channel), empty)
        c = by_key.get((compare_month, channel), empty)
        paid_change = c['paid_cents'] - b['paid_cents']
        if b['orders']:
            base_aov = b['paid_cents'] / b['orders']
            calendar_effect = round(b['paid_cents'] * (scale - 1))
            volume = round((c['orders'] - b['orders'] * scale) * base_aov)
        else:
            calendar_effect, volume = 0, paid_change
        order_value = paid_change - calendar_effect - volume
        refunds = -(c['refund_cents'] - b['refund_cents'])
        total = c['net_cents'] - b['net_cents']
        if calendar_effect + volume + order_value + refunds != total:
            raise ValueError('Bridge does not balance for channel ' + channel)
        result.append({'channel': channel, 'base_net_cents': b['net_cents'], 'compare_net_cents': c['net_cents'],
                       'base_orders': b['orders'], 'compare_orders': c['orders'],
                       'calendar_cents': calendar_effect, 'volume_cents': volume,
                       'order_value_cents': order_value, 'refunds_cents': refunds, 'total_cents': total})
    totals = {k: sum(r[k] for r in result) for k in
              ['base_net_cents', 'compare_net_cents', 'calendar_cents', 'volume_cents', 'order_value_cents', 'refunds_cents', 'total_cents']}
    if totals['compare_net_cents'] - totals['base_net_cents'] != totals['total_cents']:
        raise ValueError('Channel bridge does not reconcile to the total change')
    decline = -totals['total_cents']
    for r in result:
        r['share_of_change'] = round(r['total_cents'] / totals['total_cents'], 4) if totals['total_cents'] else None
    result.sort(key=lambda r: r['total_cents'])
    return {'base_month': base_month, 'compare_month': compare_month,
            'days': [base_days, compare_days], 'channels': result, 'total': totals,
            'decline_cents': decline}


def in_pounds(bridge):
    """Display copy of the bridge with pounds instead of pence (exact to 2 dp)."""
    def convert(row):
        return {k.replace('_cents', ''): (v / 100 if k.endswith('_cents') else v) for k, v in row.items()}
    return {'base_month': bridge['base_month'], 'compare_month': bridge['compare_month'], 'days': bridge['days'],
            'channels': [convert(r) for r in bridge['channels']], 'total': convert(bridge['total'])}
