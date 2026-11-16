/* Dashboards for the three projects. Each one reads the JSON its pipeline exported. */
(function (global) {
  'use strict';
  var C = global.Charts, esc = C.esc;
  var MINUS = '−';

  function num(v, dp) { return Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }); }
  function sign(v) { return v < 0 ? MINUS : '+'; }
  var f = {
    gbp: function (v) { return (v < 0 ? MINUS : '') + '£' + num(v, 2); },
    gbp0: function (v) { return (v < 0 ? MINUS : '') + '£' + num(v, 0); },
    gbpK: function (v) { return v === 0 ? '£0' : (v < 0 ? MINUS : '') + '£' + num(v / 1000, 0) + 'k'; },
    gbpSigned: function (v) { return sign(v) + '£' + num(v, 2); },
    gbpSignedShort: function (v) { return sign(v) + '£' + num(v / 1000, 1) + 'k'; },
    usd: function (v) { return (v < 0 ? MINUS : '') + '$' + num(v, 2); },
    usdK: function (v) { return v === 0 ? '$0' : '$' + num(v / 1000, 0) + 'k'; },
    usdSigned: function (v) { return sign(v) + '$' + num(v, 2); },
    pct: function (v, dp) { return num(v * 100, dp === undefined ? 1 : dp) + '%'; },
    pp: function (v) { return sign(v) + num(v * 100, 2) + ' pp'; },
    ppShort: function (v) { return (v === 0 ? '0' : sign(v) + num(v * 100, 1)) + ' pp'; },
    int: function (v) { return (v < 0 ? MINUS : '') + num(v, 0); }
  };

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function figure(root, o) {
    var fig = el('<figure class="fig' + (o.span ? ' span-2' : '') + '"><h3>' + esc(o.title) + '</h3>' +
      (o.sub ? '<p class="sub">' + o.sub + '</p>' : '') +
      (o.legend ? '<div class="legend">' + o.legend.map(function (l) {
        return '<span><i class="' + (l.line ? 'line' : '') + '" style="background:' + l.color + '"></i>' + esc(l.label) + '</span>';
      }).join('') + '</div>' : '') +
      '<div class="chart"></div>' + (o.after || '') +
      (o.table ? '<details><summary>Show as table</summary>' + o.table + '</details>' : '') + '</figure>');
    fig.style.margin = '0';
    root.appendChild(fig);
    return fig.querySelector('.chart');
  }
  function checks(items) {
    return '<ul class="checks">' + items.map(function (c) {
      return '<li><span class="' + (c.ok ? 'ok' : 'bad') + '" aria-hidden="true">' + (c.ok ? '✓' : '✗') + '</span><span><b>' + (c.ok ? 'Pass' : 'Fail') + '</b> · ' + esc(c.label) + '</span></li>';
    }).join('') + '</ul>';
  }
  function tiles(root, items) {
    var t = el('<div class="tiles span-2">' + items.map(function (i) {
      return '<div class="tile"><span class="v">' + esc(i.v) + '</span><span class="k">' + esc(i.k) + '</span></div>';
    }).join('') + '</div>');
    t.style.gridColumn = '1 / -1';
    root.appendChild(t);
  }
  function monthName(m) {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m.slice(5, 7), 10) - 1];
  }

  /* ---------------- Revenue Trust ---------------- */
  function revenueTrust(root, d, opts) {
    var b = d.channel_bridge, t = b.total;
    if (opts && opts.tiles) {
      var net = d.metrics[0].value;
      tiles(root, [
        { v: f.gbp(net), k: 'Net revenue, Jan–Jun 2025' },
        { v: d.quality_counts.reconciled_days + ' / ' + d.reconciliation.length, k: 'days that match the ledger to the penny' },
        { v: f.gbpSigned(t.total), k: monthName(b.compare_month) + ' vs ' + monthName(b.base_month) + ' net revenue' },
        { v: Math.round(b.channels[0].share_of_change * 100) + '%', k: 'of that change from ' + b.channels[0].channel }
      ]);
    }
    var monthly = d.monthly.map(function (m, i, a) {
      return { label: monthName(m.month) + ' 2025', short: monthName(m.month), value: m.net_revenue, labelled: i >= a.length - 2 };
    });
    C.columns(figure(root, {
      title: 'Net revenue by month',
      sub: 'Paid sales minus refunds. Refunds count in the month they were posted.',
      table: C.table([{ label: 'Month', value: 'month' }, { label: 'Orders', value: function (r) { return f.int(r.orders); }, num: true },
        { label: 'Gross', value: function (r) { return f.gbp(r.gross_revenue); }, num: true }, { label: 'Discounts', value: function (r) { return f.gbp(r.discounts); }, num: true },
        { label: 'Refunds', value: function (r) { return f.gbp(r.refunds); }, num: true }, { label: 'Net', value: function (r) { return f.gbp(r.net_revenue); }, num: true }], d.monthly)
    }), { rows: monthly, fmt: f.gbp, shortFmt: function (v) { return '£' + num(v / 1000, 1) + 'k'; }, tickFmt: f.gbpK, height: 230 });

    var parts = [
      { label: 'Shorter month (' + b.days[1] + ' vs ' + b.days[0] + ' days)', value: t.calendar },
      { label: 'Order volume vs run-rate', value: t.volume },
      { label: 'Average order value', value: t.order_value },
      { label: 'Refunds', value: t.refunds }
    ];
    C.hbars(figure(root, {
      title: 'What changed from May to June',
      sub: 'The parts add up to the total change of <b>' + esc(f.gbpSigned(t.total)) + '</b>. Pink lowers revenue, cyan raises it.',
      table: C.table([{ label: 'Component', value: 'label' }, { label: 'Change', value: function (r) { return f.gbpSigned(r.value); }, num: true }],
        parts.concat([{ label: 'Total', value: t.total, _total: true }]))
    }), { rows: parts, fmt: f.gbpSigned, shortFmt: f.gbpSignedShort, colorFor: function (v) { return v < 0 ? 'var(--neg)' : 'var(--pos)'; }, labelWidth: 190 });

    var rows = b.channels.map(function (c) { return { label: c.channel, value: c.total }; });
    var bridgeTable = C.table([
      { label: 'Channel', value: 'channel' },
      { label: 'Orders May → Jun', value: function (r) { return r._total ? '' : r.base_orders + ' → ' + r.compare_orders; }, num: true },
      { label: 'Calendar', value: function (r) { return f.gbpSigned(r.calendar); }, num: true },
      { label: 'Volume', value: function (r) { return f.gbpSigned(r.volume); }, num: true },
      { label: 'Order value', value: function (r) { return f.gbpSigned(r.order_value); }, num: true },
      { label: 'Refunds', value: function (r) { return f.gbpSigned(r.refunds); }, num: true },
      { label: 'Change', value: function (r) { return f.gbpSigned(r.total); }, num: true }
    ], b.channels.concat([Object.assign({ channel: 'Total', _total: true }, t)]));
    C.hbars(figure(root, {
      title: 'Change by channel', span: true,
      sub: 'Each row is that channel’s June minus May net revenue, split into the same four parts below. Every row balances to the penny.',
      after: bridgeTable
    }), {
      rows: rows, fmt: f.gbpSigned, shortFmt: f.gbpSignedShort, labelWidth: 120,
      colorFor: function (v) { return v < 0 ? 'var(--neg)' : 'var(--pos)'; },
      extraTip: function (i) { return Math.round(b.channels[i].share_of_change * 100) + '% of the total change'; }
    });

    var q = d.quarantine.reduce(function (s, r) { return s + r.rows; }, 0);
    var maxDiff = d.reconciliation.reduce(function (s, r) { return Math.max(s, Math.abs(r.difference)); }, 0);
    var checksFig = figure(root, {
      title: 'Checks before publishing', span: true,
      sub: 'These run in the same transaction as the load. If one fails, nothing is published and the previous file stays.',
      after: checks(d.quality.map(function (c) { return { ok: c.status === 'pass', label: c.name }; })) +
        '<p class="sub">Largest daily difference between the model and the ledger: <b>' + esc(f.gbp(maxDiff)) + '</b> across ' + d.reconciliation.length +
        ' days. ' + q + ' refunds quarantined: ' + d.quarantine.map(function (r) { return esc(r.reason.replace(/_/g, ' ')); }).join(', ') + '.</p>'
    });
    checksFig.remove();
  }

  /* ---------------- Experiment Lab ---------------- */
  function experimentLab(root, d, opts) {
    var p = d.primary, g = d.guardrail, r = d.robustness;
    if (opts && opts.tiles) {
      tiles(root, [
        { v: f.pp(p.absolute_lift), k: '7-day activation (95% CI ' + f.ppShort(p.ci_low) + ' to ' + f.ppShort(p.ci_high) + ')' },
        { v: f.pp(g.absolute_lift), k: 'support contacts (limit +0.50 pp)' },
        { v: d.users.toLocaleString('en-GB'), k: 'randomized users, SRM p = ' + d.srm.p_value.toFixed(2) },
        { v: d.decision === 'HOLD' ? 'Hold' : 'Ship', k: 'decision under the pre-agreed rule' }
      ]);
    }
    var ctl = d.variants[0], trt = d.variants[1];
    var stages = d.funnel.map(function (s) { return { label: s.stage }; });
    var ctlRates = d.funnel.map(function (s) { return s.control / ctl.assigned_users; });
    var trtRates = d.funnel.map(function (s) { return s.treatment / trt.assigned_users; });
    C.hbars(figure(root, {
      title: 'Onboarding funnel by arm', span: true,
      sub: 'Share of assigned users reaching each step. Users who never saw onboarding stay in the denominator.',
      legend: [{ label: 'Control (' + ctl.assigned_users.toLocaleString('en-GB') + ')', color: 'var(--series-2)' }, { label: 'Treatment (' + trt.assigned_users.toLocaleString('en-GB') + ')', color: 'var(--series-1)' }],
      table: C.table([{ label: 'Step', value: 'stage' }, { label: 'Control', value: function (s) { return f.int(s.control) + ' (' + f.pct(s.control / ctl.assigned_users) + ')'; }, num: true },
        { label: 'Treatment', value: function (s) { return f.int(s.treatment) + ' (' + f.pct(s.treatment / trt.assigned_users) + ')'; }, num: true }], d.funnel)
    }), { categories: stages, series: [{ name: 'Control', color: 'var(--series-2)', values: ctlRates }, { name: 'Treatment', color: 'var(--series-1)', values: trtRates }], fmt: function (v) { return f.pct(v); }, max: 1, labelWidth: 150 });

    var ic = r.interval_check;
    function rowsFor(key) {
      var point = key === 'activation' ? p.absolute_lift : g.absolute_lift;
      return [
        { label: 'Wald 95% CI', low: ic[key].wald[0], high: ic[key].wald[1], point: point, color: 'var(--total)' },
        { label: 'Bootstrap 95% CI', low: ic[key].bootstrap[0], high: ic[key].bootstrap[1], point: point, color: 'var(--series-3)' }
      ];
    }
    var legend = [{ label: 'Wald (normal approximation)', color: 'var(--total)' }, { label: 'Bootstrap, ' + ic.resamples.toLocaleString('en-GB') + ' resamples', color: 'var(--series-3)' }];
    C.intervals(figure(root, {
      title: 'Activation lift', sub: 'Needs to clear zero and the +1.5 pp practical threshold.', legend: legend,
      table: C.table([{ label: 'Method', value: 'label' }, { label: 'Low', value: function (x) { return f.pp(x.low); }, num: true }, { label: 'High', value: function (x) { return f.pp(x.high); }, num: true }], rowsFor('activation'))
    }), { rows: rowsFor('activation'), domain: [-0.005, 0.06], refs: [{ value: 0 }, { value: 0.015, label: 'threshold', dashed: true }], fmt: f.pp, tickFmt: f.ppShort, labelWidth: 120 });
    C.intervals(figure(root, {
      title: 'Support-contact increase', sub: 'The whole interval has to stay at or below +0.5 pp. It doesn’t come close.', legend: legend,
      table: C.table([{ label: 'Method', value: 'label' }, { label: 'Low', value: function (x) { return f.pp(x.low); }, num: true }, { label: 'High', value: function (x) { return f.pp(x.high); }, num: true }], rowsFor('support'))
    }), { rows: rowsFor('support'), domain: [-0.005, 0.035], refs: [{ value: 0 }, { value: 0.005, label: 'limit' }], fmt: f.pp, tickFmt: f.ppShort, labelWidth: 120 });

    var gp = r.guardrail_power;
    var curve = gp.curve.map(function (c) { return { x: c.users_per_arm, y: c.power_if_harmless }; });
    C.line(figure(root, {
      title: 'Could a harmless change pass the guardrail?', span: true,
      sub: 'Chance that a treatment with <b>no</b> effect on support passes the +0.5 pp rule, by users per arm (' + esc(f.pct(gp.control_support_rate, 2)) +
        ' baseline). A simulation of ' + gp.simulation_runs.toLocaleString('en-GB') + ' harmless tests at this size gave ' + esc(f.pct(gp.simulated_pass_rate_if_harmless, 0)) + '.',
      table: C.table([{ label: 'Users per arm', value: function (c) { return c.users_per_arm.toLocaleString('en-GB'); }, num: true }, { label: 'Pass probability', value: function (c) { return f.pct(c.power_if_harmless); }, num: true }],
        gp.curve.filter(function (c) { return c.users_per_arm % 2500 === 0 || c.users_per_arm === 1000; }))
    }), {
      points: curve, yDomain: [0, 1], height: 250,
      yFmt: function (v) { return f.pct(v, 0); }, xFmt: function (v) { return num(v / 1000, 0) + 'k'; },
      refs: [{ y: 0.8, label: '80% power' }],
      markers: [
        { x: gp.users_per_arm, y: gp.power_if_harmless, label: 'This test: ' + f.pct(gp.power_if_harmless, 0) },
        { x: gp.users_per_arm_for_80pct_power, y: 0.8, label: gp.users_per_arm_for_80pct_power.toLocaleString('en-GB') + ' per arm', dy: -10 }
      ],
      tip: function (pt) { return pt.x.toLocaleString('en-GB') + ' users per arm<br><b>' + f.pct(pt.y) + '</b> chance to pass'; }
    });

    var cohorts = {};
    d.cohorts.forEach(function (c) { (cohorts[c.cohort_week] = cohorts[c.cohort_week] || {})[c.variant] = c; });
    var crow = Object.keys(cohorts).sort().map(function (w) { return { week: w, c: cohorts[w].control, t: cohorts[w].treatment }; });
    function rate(x, k) { return x[k + '_rate'] === null ? 'not mature' : f.pct(x[k + '_rate']) + ' of ' + x['eligible_' + k]; }
    var cf = figure(root, {
      title: 'Retention by assignment week', span: true,
      sub: 'Exact-day activity on day 7 and day 30, only for users observed that long. Exploratory, not part of the decision.',
      after: C.table([{ label: 'Week', value: 'week' }, { label: 'D7 control', value: function (x) { return rate(x.c, 'd7'); }, num: true }, { label: 'D7 treatment', value: function (x) { return rate(x.t, 'd7'); }, num: true },
        { label: 'D30 control', value: function (x) { return rate(x.c, 'd30'); }, num: true }, { label: 'D30 treatment', value: function (x) { return rate(x.t, 'd30'); }, num: true }], crow)
    });
    cf.remove();

    var q = d.quality;
    var qf = figure(root, {
      title: 'Checks before the decision', span: true,
      after: checks([
        { ok: d.srm.passed, label: 'Allocation matches 50/50 (sample-ratio mismatch p = ' + d.srm.p_value.toFixed(2) + ')' },
        { ok: q.primary_window_mature, label: 'Every user has a complete 7-day window' },
        { ok: q.assignments_unique, label: 'One assignment per user' },
        { ok: q.reconciliation_passed, label: 'Raw events reconcile: ' + f.int(q.raw_events) + ' = ' + f.int(q.clean_events) + ' accepted + ' + q.duplicates_removed + ' replays + ' + q.quarantined_events + ' quarantined' },
        { ok: p.ci_low > 0 && p.absolute_lift >= 0.015, label: 'Activation lift above zero and at least +1.5 pp' },
        { ok: g.passed, label: 'Support-contact guardrail (upper bound ≤ +0.5 pp)' }
      ])
    });
    qf.remove();
  }

  /* ---------------- Mobility Pipeline ---------------- */
  function mobilityPipeline(root, d, opts) {
    var s = d.summary;
    if (opts && opts.tiles) {
      tiles(root, [
        { v: f.int(s.trips), k: 'canonical trips from ' + f.int(s.raw_rows) + ' delivered rows' },
        { v: f.int(s.duplicate_rows), k: 'duplicate deliveries suppressed' },
        { v: f.int(s.rejected_rows), k: 'rows quarantined (' + s.rejection_pct.toFixed(2) + '% of input)' },
        { v: s.restated_days + ' / ' + d.daily.length, k: 'days revised after first publication (max +' + s.max_day_fare_change_pct.toFixed(2) + '%)' }
      ]);
    }
    var biggest = d.restatements.reduce(function (a, b) { return b.fare_change_usd > a.fare_change_usd ? b : a; });
    C.columns(figure(root, {
      title: 'How much each day moved after it was first published', span: true,
      sub: 'Fare added to each day by the late-arrival and correction batches, against the figure published right after that day’s first batch.',
      table: C.table([{ label: 'Date', value: 'date' }, { label: 'Trips first', value: 'first_trips', num: true }, { label: 'Trips now', value: 'final_trips', num: true },
        { label: 'Fare first', value: function (r) { return f.usd(r.first_fare_usd); }, num: true }, { label: 'Fare now', value: function (r) { return f.usd(r.final_fare_usd); }, num: true },
        { label: 'Change', value: function (r) { return f.usdSigned(r.fare_change_usd) + ' (' + (r.fare_change_usd / r.first_fare_usd * 100).toFixed(1) + '%)'; }, num: true },
        { label: 'Revisions', value: 'revisions', num: true }], d.restatements)
    }), {
      height: 230, fmt: f.usdSigned, shortFmt: function (v) { return sign(v) + '$' + num(v, 0); },
      tickFmt: function (v) { return v === 0 ? '$0' : '$' + num(v, 0); },
      rows: d.restatements.map(function (r) {
        return {
          label: r.date, short: String(parseInt(r.date.slice(8), 10)) + ' Jan', value: r.fare_change_usd, labelled: r === biggest,
          tip: esc(r.date) + '<br>' + esc(f.usd(r.first_fare_usd)) + ' → ' + esc(f.usd(r.final_fare_usd)) + '<br><b>' + esc(f.usdSigned(r.fare_change_usd)) +
            '</b> (' + (r.fare_change_usd / r.first_fare_usd * 100).toFixed(1) + '%), ' + (r.trip_change > 0 ? '+' : '') + r.trip_change + ' trips'
        };
      })
    });

    var bf = figure(root, {
      title: 'What each batch did', span: true,
      sub: 'Every input row is accounted for: raw = accepted + rejected + duplicate. The last two columns are changes to days that had already been published.',
      after: C.table([
        { label: 'Batch', value: 'batch_id' }, { label: 'Raw', value: function (r) { return f.int(r.raw_rows); }, num: true },
        { label: 'Accepted', value: function (r) { return f.int(r.accepted_rows); }, num: true }, { label: 'Rejected', value: 'rejected_rows', num: true },
        { label: 'Duplicate', value: 'duplicate_rows', num: true }, { label: 'Corrected', value: 'corrected_rows', num: true },
        { label: 'Trips restated', value: function (r) { return r.restated ? (r.restated.trip_change > 0 ? '+' : '') + r.restated.trip_change : '–'; }, num: true },
        { label: 'Fare restated', value: function (r) { return r.restated ? f.usdSigned(r.restated.fare_change_usd) : '–'; }, num: true }
      ], d.batches.map(function (b) {
        var match = (d.restatements_by_batch || []).filter(function (x) { return x.batch_id === b.batch_id; })[0];
        return Object.assign({ restated: match }, b);
      }))
    });
    bf.remove();

    C.hbars(figure(root, {
      title: 'Why rows were quarantined',
      sub: 'Rejected rows are kept with the raw line so the source can be fixed.',
      table: C.table([{ label: 'Reason', value: 'reason' }, { label: 'Rows', value: 'rows', num: true }], d.quarantine)
    }), { rows: d.quarantine.map(function (r) { return { label: r.reason.replace(/_/g, ' '), value: r.rows }; }), fmt: f.int, labelWidth: 130 });

    var zones = d.zones.slice().sort(function (a, b) { return b.trips - a.trips; });
    C.hbars(figure(root, {
      title: 'Trips by pickup zone',
      sub: 'Full period, current trips. Demo zone codes, not TLC LocationIDs.',
      table: C.table([{ label: 'Zone', value: 'zone' }, { label: 'Trips', value: 'trips', num: true }, { label: 'Fare', value: function (z) { return f.usd(z.fare_usd); }, num: true }], zones)
    }), { rows: zones.map(function (z) { return { label: z.zone, value: z.trips }; }), fmt: f.int, labelWidth: 130 });

    var cf = figure(root, {
      title: 'Checks before publishing', span: true,
      sub: 'If any check fails, the dashboard file is not replaced.',
      after: checks(d.quality_checks.map(function (c) { return { ok: c.passed, label: c.name }; }))
    });
    cf.remove();
  }

  var registry = { 'revenue-trust': revenueTrust, 'experiment-lab': experimentLab, 'mobility-pipeline': mobilityPipeline };
  global.Dashboards = {
    render: function (name, root, data, opts) {
      root.innerHTML = '';
      registry[name](root, data, opts || {});
    },
    format: f
  };
})(window);
