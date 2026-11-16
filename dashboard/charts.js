/* Small SVG chart helpers. No dependencies.
   Every chart draws at its container's real width and redraws when that width changes,
   so text stays a readable size on phones. Colours come from CSS custom properties. */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function node(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, attrs) {
    var t = node('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* --- scales --- */
  function linear(d0, d1, r0, r1) {
    var f = function (v) { return r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0); };
    f.domain = [d0, d1];
    return f;
  }
  function niceStep(span, count) {
    var raw = span / Math.max(1, count);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return step * mag;
  }
  function ticks(min, max, count) {
    var step = niceStep(max - min, count || 4);
    var start = Math.floor(min / step) * step;
    var end = Math.ceil(max / step) * step;
    var out = [];
    for (var v = start; v <= end + step / 2; v += step) out.push(Math.round(v / step) * step);
    return out;
  }

  /* bar with a 4px rounded data end and a square baseline end */
  function vbar(x, w, yBase, yEnd) {
    var h = Math.abs(yBase - yEnd);
    var r = Math.min(4, w / 2, h);
    if (h < 0.5) return 'M' + x + ',' + yBase + 'h' + w;
    if (yEnd < yBase) { // grows up
      return 'M' + x + ',' + yBase + 'V' + (yEnd + r) + 'Q' + x + ',' + yEnd + ' ' + (x + r) + ',' + yEnd +
        'H' + (x + w - r) + 'Q' + (x + w) + ',' + yEnd + ' ' + (x + w) + ',' + (yEnd + r) + 'V' + yBase + 'Z';
    }
    return 'M' + x + ',' + yBase + 'V' + (yEnd - r) + 'Q' + x + ',' + yEnd + ' ' + (x + r) + ',' + yEnd +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + yEnd + ' ' + (x + w) + ',' + (yEnd - r) + 'V' + yBase + 'Z';
  }
  function hbar(y, h, xBase, xEnd) {
    var w = Math.abs(xEnd - xBase);
    var r = Math.min(4, h / 2, w);
    if (w < 0.5) return 'M' + xBase + ',' + y + 'v' + h;
    if (xEnd > xBase) {
      return 'M' + xBase + ',' + y + 'H' + (xEnd - r) + 'Q' + xEnd + ',' + y + ' ' + xEnd + ',' + (y + r) +
        'V' + (y + h - r) + 'Q' + xEnd + ',' + (y + h) + ' ' + (xEnd - r) + ',' + (y + h) + 'H' + xBase + 'Z';
    }
    return 'M' + xBase + ',' + y + 'H' + (xEnd + r) + 'Q' + xEnd + ',' + y + ' ' + xEnd + ',' + (y + r) +
      'V' + (y + h - r) + 'Q' + xEnd + ',' + (y + h) + ' ' + (xEnd + r) + ',' + (y + h) + 'H' + xBase + 'Z';
  }

  /* --- mounting, resize and tooltips --- */
  function mount(container, height, draw) {
    container.innerHTML = '';
    var tip = document.createElement('div');
    tip.className = 'tip';
    tip.hidden = true;
    var lastWidth = 0;
    function render() {
      var width = Math.floor(container.clientWidth);
      if (!width || width === lastWidth) return;
      lastWidth = width;
      container.innerHTML = '';
      var svg = node('svg', { width: width, height: height, viewBox: '0 0 ' + width + ' ' + height, role: 'img' }, container);
      container.appendChild(tip);
      draw(svg, width, height, tip);
      bindTips(container, svg, tip);
    }
    render();
    if (global.ResizeObserver) new ResizeObserver(render).observe(container);
    else global.addEventListener('resize', render);
  }
  function showTip(container, tip, html, evt) {
    var box = container.getBoundingClientRect();
    tip.innerHTML = html;
    tip.hidden = false;
    var x = evt.clientX - box.left;
    var half = tip.offsetWidth / 2;
    x = Math.max(half, Math.min(box.width - half, x));
    tip.style.left = x + 'px';
    tip.style.top = (evt.clientY - box.top) + 'px';
  }
  function bindTips(container, svg, tip) {
    svg.addEventListener('mousemove', function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute('data-own-tip')) return;
      var t = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (!t) { tip.hidden = true; return; }
      showTip(container, tip, t.getAttribute('data-tip'), e);
    });
    svg.addEventListener('mouseleave', function () { tip.hidden = true; });
  }

  function yAxis(svg, y, tickVals, x0, x1, fmt) {
    var g = node('g', { class: 'grid' }, svg);
    tickVals.forEach(function (v) {
      node('line', { x1: x0, x2: x1, y1: y(v), y2: y(v) }, g);
      text(svg, x0 - 8, y(v) + 4, fmt(v), { 'text-anchor': 'end' });
    });
  }

  /* --- column chart, one series --- */
  function columns(container, o) {
    var height = o.height || 240;
    mount(container, height, function (svg, W, H) {
      var m = { t: 22, r: 8, b: 30, l: o.left || 56 };
      var vals = o.rows.map(function (r) { return r.value; });
      var tv = ticks(Math.min(0, Math.min.apply(null, vals)), Math.max.apply(null, vals) * 1.08, 4);
      var y = linear(tv[0], tv[tv.length - 1], H - m.b, m.t);
      yAxis(svg, y, tv, m.l, W - m.r, o.tickFmt || o.fmt);
      var band = (W - m.l - m.r) / o.rows.length;
      var bw = Math.min(28, band * 0.6);
      o.rows.forEach(function (r, i) {
        var x = m.l + band * i + (band - bw) / 2;
        var p = node('path', { d: vbar(x, bw, y(0), y(r.value)), fill: r.color || 'var(--series-1)', 'data-tip': r.tip || (esc(r.label) + '<br><b>' + esc(o.fmt(r.value)) + '</b>') }, svg);
        node('rect', { x: m.l + band * i, y: m.t, width: band, height: H - m.t - m.b, fill: 'transparent', 'data-tip': p.getAttribute('data-tip') }, svg);
        text(svg, x + bw / 2, H - m.b + 18, r.short || r.label, { 'text-anchor': 'middle' });
        if (r.labelled) text(svg, x + bw / 2, y(r.value) - 7, (band < 70 && o.shortFmt ? o.shortFmt : o.fmt)(r.value), { 'text-anchor': 'middle', class: 'val' });
      });
      node('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), class: 'base' }, svg);
    });
  }

  /* --- grouped columns (2 series) --- */
  function groupedColumns(container, o) {
    var height = o.height || 240;
    mount(container, height, function (svg, W, H) {
      var m = { t: 16, r: 8, b: 30, l: o.left || 56 };
      var all = [];
      o.series.forEach(function (s) { all = all.concat(s.values); });
      var lo = o.min !== undefined ? o.min : 0;
      var tv = ticks(lo, Math.max.apply(null, all) * 1.04, 4);
      var y = linear(tv[0], tv[tv.length - 1], H - m.b, m.t);
      yAxis(svg, y, tv, m.l, W - m.r, o.tickFmt || o.fmt);
      var band = (W - m.l - m.r) / o.categories.length;
      var gap = 2;
      var bw = Math.max(2, Math.min(14, (band * 0.74 - gap) / o.series.length));
      var every = Math.ceil(o.categories.length / Math.max(1, Math.floor((W - m.l) / 46)));
      o.categories.forEach(function (c, i) {
        var groupW = bw * o.series.length + gap * (o.series.length - 1);
        var x0 = m.l + band * i + (band - groupW) / 2;
        var tipHtml = esc(c.label) + o.series.map(function (s) { return '<br>' + esc(s.name) + ': <b>' + esc(o.fmt(s.values[i])) + '</b>'; }).join('');
        if (o.extraTip) tipHtml += '<br>' + o.extraTip(i);
        o.series.forEach(function (s, j) {
          node('path', { d: vbar(x0 + j * (bw + gap), bw, y(tv[0]), y(s.values[i])), fill: s.color }, svg);
        });
        node('rect', { x: m.l + band * i, y: m.t, width: band, height: H - m.t - m.b, fill: 'transparent', 'data-tip': tipHtml }, svg);
        if (i % every === 0) text(svg, m.l + band * i + band / 2, H - m.b + 18, c.short || c.label, { 'text-anchor': 'middle' });
      });
      node('line', { x1: m.l, x2: W - m.r, y1: y(tv[0]), y2: y(tv[0]), class: 'base' }, svg);
    });
  }

  /* --- horizontal bars: one series, or grouped --- */
  function hbars(container, o) {
    var series = o.series || [{ name: '', color: 'var(--series-1)', values: o.rows.map(function (r) { return r.value; }) }];
    var cats = o.categories || o.rows.map(function (r) { return { label: r.label }; });
    var barH = 14, gap = 2, groupGap = 14;
    var groupH = series.length * barH + (series.length - 1) * gap;
    var wideHeight = cats.length * (groupH + groupGap) + 8;
    var narrowHeight = cats.length * (groupH + groupGap + 18) + 8;
    // On narrow screens the label sits above its bars instead of beside them.
    var narrowNow = function () { return container.clientWidth < 480; };
    mount(container, narrowNow() ? narrowHeight : wideHeight, function (svg, W) {
      var narrow = W < 480;
      var H = narrow ? narrowHeight : wideHeight;
      svg.setAttribute('height', H);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var vf = narrow && o.shortFmt ? o.shortFmt : o.fmt;
      var labelW = narrow ? 0 : Math.min(o.labelWidth || 170, W * 0.4);
      var valueW = narrow ? 58 : 74;
      var all = [];
      series.forEach(function (s) { all = all.concat(s.values); });
      var max = o.max || Math.max(0, Math.max.apply(null, all));
      var min = Math.min(0, Math.min.apply(null, all));
      var x = linear(min, max, labelW + (min < 0 ? valueW : 0), W - (max > 0 ? valueW : 8));
      var rowH = groupH + groupGap + (narrow ? 18 : 0);
      cats.forEach(function (c, i) {
        var y0 = 4 + i * rowH + (narrow ? 18 : 0);
        if (narrow) text(svg, 0, y0 - 6, c.label, { class: 'lbl' });
        else text(svg, labelW - 10, y0 + groupH / 2 + 4, c.label, { 'text-anchor': 'end', class: 'lbl' });
        series.forEach(function (s, j) {
          var yy = y0 + j * (barH + gap);
          var v = s.values[i];
          var tip = esc(c.label) + (s.name ? '<br>' + esc(s.name) : '') + ': <b>' + esc(o.fmt(v)) + '</b>' + (o.extraTip ? '<br>' + o.extraTip(i, j) : '');
          var fill = o.colorFor ? o.colorFor(v, i) : s.color;
          node('path', { d: hbar(yy, barH, x(0), x(v)), fill: fill, 'data-tip': tip }, svg);
          var neg = v < 0;
          text(svg, x(v) + (neg ? -6 : 6), yy + barH / 2 + 4, vf(v), { class: 'val', 'text-anchor': neg ? 'end' : 'start' });
        });
      });
      node('line', { x1: x(0), x2: x(0), y1: narrow ? 18 : 0, y2: H - 4, class: 'base' }, svg);
    });
  }

  /* --- waterfall: start total, signed steps, end total --- */
  function waterfall(container, o) {
    var height = o.height || 260;
    mount(container, height, function (svg, W, H) {
      var m = { t: 24, r: 8, b: 36, l: o.left || 62 };
      var run = 0, bars = [];
      o.steps.forEach(function (s) {
        if (s.total) { bars.push({ s: s, from: 0, to: s.value }); run = s.value; }
        else { bars.push({ s: s, from: run, to: run + s.value }); run += s.value; }
      });
      var lo = Math.min.apply(null, bars.map(function (b) { return Math.min(b.from, b.to); }));
      var hi = Math.max.apply(null, bars.map(function (b) { return Math.max(b.from, b.to); }));
      var floor = o.floor !== undefined ? o.floor : 0;
      var tv = ticks(floor, hi * 1.02, 4).filter(function (v) { return v >= floor; });
      if (tv[0] > floor) tv.unshift(floor);
      var y = linear(floor, tv[tv.length - 1], H - m.b, m.t);
      yAxis(svg, y, tv, m.l, W - m.r, o.tickFmt);
      var band = (W - m.l - m.r) / bars.length;
      var bw = Math.min(30, band * 0.55);
      bars.forEach(function (b, i) {
        var x = m.l + band * i + (band - bw) / 2;
        var top = y(Math.max(b.from, b.to)), bot = y(Math.max(floor, Math.min(b.from, b.to)));
        var color = b.s.total ? 'var(--total)' : (b.s.value >= 0 ? 'var(--pos)' : 'var(--neg)');
        var tip = esc(b.s.label) + '<br><b>' + esc(b.s.total ? o.fmt(b.s.value) : o.signed(b.s.value)) + '</b>';
        if (b.s.total) node('path', { d: vbar(x, bw, bot, top), fill: color, 'data-tip': tip }, svg);
        else node('rect', { x: x, y: top, width: bw, height: Math.max(1, bot - top), rx: 2, fill: color, 'data-tip': tip }, svg);
        if (i < bars.length - 1) {
          var level = y(b.to);
          node('line', { x1: x + bw, x2: x + band, y1: level, y2: level, class: 'ref' }, svg);
        }
        node('rect', { x: m.l + band * i, y: m.t, width: band, height: H - m.t - m.b, fill: 'transparent', 'data-tip': tip }, svg);
        var labelY = b.s.total || b.s.value >= 0 ? top - 7 : bot + 15;
        text(svg, x + bw / 2, labelY, b.s.total ? o.short(b.s.value) : o.shortSigned(b.s.value), { 'text-anchor': 'middle', class: 'val' });
        var words = (b.s.short || b.s.label).split('\n');
        words.forEach(function (wd, k) { text(svg, x + bw / 2, H - m.b + 16 + k * 14, wd, { 'text-anchor': 'middle' }); });
      });
      if (floor > 0) text(svg, m.l, H - 4, 'Axis starts at ' + o.tickFmt(floor), { 'font-size': 11 });
    });
  }

  /* --- interval (forest) plot --- */
  function intervals(container, o) {
    var rowH = 34;
    var height = o.rows.length * rowH + 40;
    mount(container, height, function (svg, W, H) {
      var labelW = Math.min(o.labelWidth || 150, W * 0.32);
      var m = { t: 8, r: 16, b: 30 };
      var lo = o.domain[0], hi = o.domain[1];
      var x = linear(lo, hi, labelW, W - m.r);
      var tv = ticks(lo, hi, Math.max(2, Math.min(6, Math.floor((W - labelW - m.r) / 62)))).filter(function (v) { return v >= lo - 1e-9 && v <= hi + 1e-9; });
      var g = node('g', { class: 'grid' }, svg);
      tv.forEach(function (v) {
        node('line', { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b }, g);
        text(svg, x(v), H - m.b + 18, o.tickFmt(v), { 'text-anchor': 'middle' });
      });
      (o.refs || []).forEach(function (r) {
        node('line', { x1: x(r.value), x2: x(r.value), y1: m.t, y2: H - m.b, stroke: 'var(--ink-2)', 'stroke-width': 1.5, 'stroke-dasharray': r.dashed ? '4 3' : null }, svg);
        if (r.label) text(svg, x(r.value) + 5, m.t + 10, r.label, { class: 'lbl', 'font-size': 11 });
      });
      o.rows.forEach(function (r, i) {
        var cy = m.t + 14 + i * rowH + (o.refs && o.refs.some(function (q) { return q.label; }) ? 8 : 0);
        text(svg, labelW - 12, cy + 4, r.label, { 'text-anchor': 'end', class: 'lbl' });
        var tip = esc(r.label) + '<br><b>' + esc(o.fmt(r.point)) + '</b> (' + esc(o.fmt(r.low)) + ' to ' + esc(o.fmt(r.high)) + ')';
        node('line', { x1: x(r.low), x2: x(r.high), y1: cy, y2: cy, stroke: r.color, 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
        [r.low, r.high].forEach(function (v) { node('line', { x1: x(v), x2: x(v), y1: cy - 5, y2: cy + 5, stroke: r.color, 'stroke-width': 2, 'stroke-linecap': 'round' }, svg); });
        node('circle', { cx: x(r.point), cy: cy, r: 5, fill: r.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
        node('rect', { x: labelW, y: cy - rowH / 2, width: W - labelW, height: rowH, fill: 'transparent', 'data-tip': tip }, svg);
      });
    });
  }

  /* --- single-series line with crosshair --- */
  function line(container, o) {
    var height = o.height || 240;
    mount(container, height, function (svg, W, H, tip) {
      var m = { t: 16, r: 14, b: 32, l: o.left || 46 };
      var xs = o.points.map(function (p) { return p.x; });
      var x = linear(Math.min.apply(null, xs), Math.max.apply(null, xs), m.l, W - m.r);
      var y = linear(o.yDomain[0], o.yDomain[1], H - m.b, m.t);
      yAxis(svg, y, ticks(o.yDomain[0], o.yDomain[1], 4), m.l, W - m.r, o.yFmt);
      ticks(x.domain[0], x.domain[1], Math.max(2, Math.floor((W - m.l) / 90))).forEach(function (v) {
        if (v < x.domain[0] || v > x.domain[1]) return;
        text(svg, x(v), H - m.b + 18, o.xFmt(v), { 'text-anchor': 'middle' });
      });
      (o.refs || []).forEach(function (r) {
        node('line', { x1: m.l, x2: W - m.r, y1: y(r.y), y2: y(r.y), stroke: 'var(--ink-2)', 'stroke-width': 1, 'stroke-dasharray': '4 3' }, svg);
        text(svg, m.l + 6, y(r.y) - 6, r.label, { 'text-anchor': 'start', class: 'lbl', 'font-size': 11 });
      });
      var d = o.points.map(function (p, i) { return (i ? 'L' : 'M') + x(p.x).toFixed(1) + ',' + y(p.y).toFixed(1); }).join('');
      node('path', { d: d, fill: 'none', stroke: o.color || 'var(--series-1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      node('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'base' }, svg);
      (o.markers || []).forEach(function (mk) {
        node('line', { x1: x(mk.x), x2: x(mk.x), y1: y(mk.y), y2: H - m.b, stroke: 'var(--rule-strong)', 'stroke-width': 1 }, svg);
        node('circle', { cx: x(mk.x), cy: y(mk.y), r: 5, fill: o.color || 'var(--series-1)', stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
        var anchor = x(mk.x) > W * 0.7 ? 'end' : 'start';
        text(svg, x(mk.x) + (anchor === 'end' ? -9 : 9), y(mk.y) + (mk.dy || 4), mk.label, { 'text-anchor': anchor, class: 'val' });
      });
      var hair = node('line', { y1: m.t, y2: H - m.b, stroke: 'var(--ink-2)', 'stroke-width': 1, opacity: 0 }, svg);
      var dot = node('circle', { r: 4, fill: o.color || 'var(--series-1)', stroke: 'var(--surface)', 'stroke-width': 2, opacity: 0 }, svg);
      var hit = node('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent', 'data-own-tip': '1' }, svg);
      hit.addEventListener('mousemove', function (e) {
        var box = svg.getBoundingClientRect();
        var px = e.clientX - box.left;
        var best = o.points[0];
        o.points.forEach(function (p) { if (Math.abs(x(p.x) - px) < Math.abs(x(best.x) - px)) best = p; });
        hair.setAttribute('x1', x(best.x)); hair.setAttribute('x2', x(best.x)); hair.setAttribute('opacity', 0.5);
        dot.setAttribute('cx', x(best.x)); dot.setAttribute('cy', y(best.y)); dot.setAttribute('opacity', 1);
        showTip(container, tip, o.tip(best), { clientX: box.left + x(best.x), clientY: box.top + y(best.y) });
      });
      hit.addEventListener('mouseleave', function () { hair.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); tip.hidden = true; });
    });
  }

  /* --- table view --- */
  function table(columns, rows, opts) {
    opts = opts || {};
    var head = '<tr>' + columns.map(function (c) { return '<th' + (c.num ? ' class="n"' : '') + '>' + esc(c.label) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) {
      return '<tr' + (r._total ? ' class="total"' : '') + '>' + columns.map(function (c) {
        var v = typeof c.value === 'function' ? c.value(r) : r[c.value];
        return '<td' + (c.num ? ' class="n"' : '') + '>' + esc(v) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table' + (opts.caption ? ' aria-label="' + esc(opts.caption) + '"' : '') + '><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  global.Charts = { columns: columns, groupedColumns: groupedColumns, hbars: hbars, waterfall: waterfall, intervals: intervals, line: line, table: table, esc: esc };
})(window);
