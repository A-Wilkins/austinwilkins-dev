/* =========================================================================
   charts.js — hand-built SVG charts. No library, no network request.
   Forms follow the data's job: trend over time = line/area; magnitude
   comparison = horizontal bars on a single-hue sequential ramp.
   ========================================================================= */
window.Charts = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* Sequential ramps, ordered low -> high magnitude. Light stays no lighter
     than step 250 and dark no darker than step 600, so the smallest bar is
     still visible against its surface. */
  var RAMP_LIGHT = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
  var RAMP_DARK  = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'];

  function isDark() { return document.documentElement.getAttribute('data-theme') !== 'light'; }
  function ramp() { return isDark() ? RAMP_DARK : RAMP_LIGHT; }

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---------- formatting ---------- */
  var Fmt = {
    money: function (v) {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0
      }).format(v);
    },
    compact: function (v) {
      var abs = Math.abs(v);
      if (abs >= 1e6) return (v / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
      if (abs >= 1e3) return (v / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
      return String(Math.round(v));
    },
    month: function (iso) {
      var p = iso.split('-');
      return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1] - 1] + " '" + p[0].slice(2);
    },
    dayMonth: function (iso) {
      var p = iso.split('-');
      return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1] - 1] + ' ' + (+p[2]);
    }
  };

  /* "nice" axis bounds so gridlines land on round numbers */
  function niceBounds(min, max) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    var err = (span / 4) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3) step *= 5; else if (err >= 1.5) step *= 2;
    return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step: step };
  }

  /* =======================================================================
     TREND — line / area / grouped bars over time, with crosshair tooltip
     ======================================================================= */
  function trend(host, rows, opts) {
    opts = opts || {};
    var shape = opts.shape || 'area';
    var series = (opts.series || []).filter(function (s) { return s.on; });

    host.innerHTML = '';
    if (!rows.length || !series.length) {
      host.appendChild(emptyNote(rows.length ? 'Turn on a series to see the chart.'
                                             : 'Save a snapshot to start the chart.'));
      return;
    }

    var W = Math.max(host.clientWidth || 640, 320), H = 300;
    var m = { t: 18, r: 18, b: 30, l: 62 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;

    var vals = [];
    rows.forEach(function (r) { series.forEach(function (s) { vals.push(r[s.key]); }); });
    if (shape === 'bar') vals.push(0);
    var b = niceBounds(Math.min.apply(null, vals), Math.max.apply(null, vals));

    var x = function (i) { return rows.length === 1 ? m.l + iw / 2 : m.l + (i / (rows.length - 1)) * iw; };
    var y = function (v) { return m.t + ih - ((v - b.lo) / (b.hi - b.lo)) * ih; };

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img' });
    svg.setAttribute('aria-label', opts.ariaLabel || 'Net worth over time');

    /* gridlines + y labels — recessive */
    for (var g = b.lo; g <= b.hi + 1e-9; g += b.step) {
      var gy = y(g);
      svg.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: gy, y2: gy, class: 'c-grid' }));
      var t = el('text', { x: m.l - 10, y: gy + 4, class: 'c-axis', 'text-anchor': 'end' });
      t.textContent = Fmt.compact(g);
      svg.appendChild(t);
    }
    /* zero line reads stronger than a gridline when the scale crosses it */
    if (b.lo < 0 && b.hi > 0) {
      svg.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), class: 'c-zero' }));
    }

    /* x labels — about five, never crowded */
    var stride = Math.max(1, Math.ceil(rows.length / 5));
    rows.forEach(function (r, i) {
      if (i % stride && i !== rows.length - 1) return;
      var t = el('text', { x: x(i), y: H - 8, class: 'c-axis', 'text-anchor': 'middle' });
      t.textContent = Fmt.month(r.date);
      svg.appendChild(t);
    });

    if (shape === 'bar') {
      var slot = iw / rows.length;
      var bw = Math.max(3, Math.min(26, (slot - 6) / series.length - 2));
      rows.forEach(function (r, i) {
        series.forEach(function (s, si) {
          var v = r[s.key];
          var bx = m.l + slot * i + slot / 2 - (series.length * (bw + 2) - 2) / 2 + si * (bw + 2);
          var top = y(Math.max(v, 0)), bot = y(Math.min(v, 0));
          svg.appendChild(el('rect', {
            x: bx, y: top, width: bw, height: Math.max(1, bot - top),
            rx: Math.min(4, bw / 2), fill: 'var(' + s.varName + ')'
          }));
        });
      });
    } else {
      series.forEach(function (s) {
        var d = rows.map(function (r, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r[s.key]).toFixed(1); }).join(' ');
        if (shape === 'area' && series.length === 1) {
          svg.appendChild(el('path', {
            d: d + ' L' + x(rows.length - 1) + ' ' + y(b.lo) + ' L' + x(0) + ' ' + y(b.lo) + ' Z',
            fill: 'var(' + s.varName + ')', opacity: .13
          }));
        }
        svg.appendChild(el('path', { d: d, fill: 'none', stroke: 'var(' + s.varName + ')', 'stroke-width': 2,
                                     'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      });

      /* direct label on the final point — identity without relying on colour */
      series.forEach(function (s) {
        var last = rows[rows.length - 1];
        var lx = x(rows.length - 1), ly = y(last[s.key]);
        svg.appendChild(el('circle', { cx: lx, cy: ly, r: 4, fill: 'var(' + s.varName + ')',
                                       stroke: 'var(--surface-1)', 'stroke-width': 2 }));
      });
    }

    /* hover layer: crosshair + markers + tooltip */
    var hover = el('g', { class: 'c-hover', opacity: 0 });
    var vline = el('line', { y1: m.t, y2: m.t + ih, class: 'c-cross' });
    hover.appendChild(vline);
    var dots = series.map(function (s) {
      var c = el('circle', { r: 5, fill: 'var(' + s.varName + ')', stroke: 'var(--surface-1)', 'stroke-width': 2 });
      hover.appendChild(c); return c;
    });
    svg.appendChild(hover);

    var tip = document.createElement('div');
    tip.className = 'tip'; tip.hidden = true;

    var capture = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent', style: 'cursor:crosshair' });
    svg.appendChild(capture);

    function at(clientX) {
      var box = svg.getBoundingClientRect();
      var px = (clientX - box.left) * (W / box.width);
      var i = rows.length === 1 ? 0 : Math.round(((px - m.l) / iw) * (rows.length - 1));
      return Math.max(0, Math.min(rows.length - 1, i));
    }
    function show(e) {
      var i = at(e.clientX), r = rows[i];
      hover.setAttribute('opacity', 1);
      vline.setAttribute('x1', x(i)); vline.setAttribute('x2', x(i));
      dots.forEach(function (c, si) { c.setAttribute('cx', x(i)); c.setAttribute('cy', y(r[series[si].key])); });

      tip.innerHTML = '<p class="tip__date">' + Fmt.dayMonth(r.date) + ' ' + r.date.slice(0, 4) + '</p>' +
        series.map(function (s) {
          return '<p class="tip__row"><span class="tip__key" style="background:var(' + s.varName + ')"></span>' +
                 '<span class="tip__label">' + s.label + '</span>' +
                 '<span class="tip__val">' + Fmt.money(r[s.key]) + '</span></p>';
        }).join('');
      tip.hidden = false;
      var box = svg.getBoundingClientRect();
      var left = (x(i) / W) * box.width;
      tip.style.left = Math.max(8, Math.min(box.width - tip.offsetWidth - 8, left - tip.offsetWidth / 2)) + 'px';
      tip.style.top = '6px';
    }
    function hide() { hover.setAttribute('opacity', 0); tip.hidden = true; }

    svg.addEventListener('mousemove', show);
    svg.addEventListener('mouseleave', hide);
    svg.addEventListener('touchmove', function (e) { if (e.touches[0]) show(e.touches[0]); }, { passive: true });
    svg.addEventListener('touchend', hide);

    host.appendChild(svg);
    host.appendChild(tip);
  }

  /* =======================================================================
     BARS — horizontal magnitude comparison on a sequential ramp
     ======================================================================= */
  function bars(host, items, opts) {
    opts = opts || {};
    host.innerHTML = '';
    if (!items.length) {
      host.appendChild(emptyNote(opts.empty || 'Nothing to show yet.'));
      return;
    }

    var total = items.reduce(function (s, i) { return s + i.value; }, 0);
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }));
    var steps = ramp();

    var list = document.createElement('div');
    list.className = 'bars';

    items.forEach(function (it) {
      var pct = max ? (it.value / max) * 100 : 0;
      var share = total ? (it.value / total) * 100 : 0;
      var stepIdx = max ? Math.min(steps.length - 1, Math.floor((it.value / max) * steps.length * 0.999)) : 0;

      var row = document.createElement('div');
      row.className = 'bars__row';
      row.innerHTML =
        '<span class="bars__label">' + escapeHTML(it.label) + '</span>' +
        '<span class="bars__track"><span class="bars__fill" style="width:' + pct.toFixed(1) + '%;background:' + steps[stepIdx] + '"></span></span>' +
        '<span class="bars__value">' + Fmt.money(it.value) + '</span>' +
        '<span class="bars__share">' + share.toFixed(0) + '%</span>';
      row.title = it.label + ' — ' + Fmt.money(it.value) + ' (' + share.toFixed(1) + '% of total)';
      list.appendChild(row);
    });

    host.appendChild(list);
  }

  function emptyNote(msg) {
    var p = document.createElement('p');
    p.className = 'chart__empty';
    p.textContent = msg;
    return p;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  return { trend: trend, bars: bars, Fmt: Fmt, escapeHTML: escapeHTML };
})();
