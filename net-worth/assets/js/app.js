/* =========================================================================
   app.js — UI wiring. Reads from Store, renders through Charts.
   ========================================================================= */
(function () {
  'use strict';

  var S = window.Store, C = window.Charts, F = C.Fmt, esc = C.escapeHTML;

  var state = {
    range: 0,            // months back; 0 = all
    shape: 'area',
    side: 'asset',
    series: [
      { key: 'net',         label: 'Net worth',   varName: '--series-1', on: true },
      { key: 'assets',      label: 'Assets',      varName: '--series-2', on: false },
      { key: 'liabilities', label: 'Liabilities', varName: '--series-3', on: false }
    ]
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- theme ---------- */
  var root = document.documentElement, toggle = $('theme-toggle');
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    toggle.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#101215' : '#f7f7f5');
  }
  applyTheme(root.getAttribute('data-theme') || 'dark');
  toggle.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('nw.theme', next); } catch (e) {}
    render();                       // ramps differ per mode
  });

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- first run vs dashboard ---------- */
  function route() {
    var has = S.hasData();
    $('empty-state').hidden = has;
    $('dashboard').hidden = !has;
    if (has) render();
  }

  /* ---------- render ---------- */
  function render() {
    var t = S.totals();
    var rows = S.series(state.range);
    var all = S.series(0);

    $('kpi-networth').textContent    = F.money(t.net);
    $('kpi-assets').textContent      = F.money(t.assets);
    $('kpi-liabilities').textContent = F.money(t.liabilities);
    $('kpi-count').textContent       = all.length;
    $('kpi-since').textContent       = all.length ? 'since ' + F.month(all[0].date) : '';

    // delta against the first snapshot in the visible range
    var d = $('kpi-delta');
    if (rows.length > 1) {
      var change = rows[rows.length - 1].net - rows[0].net;
      var pct = rows[0].net !== 0 ? (change / Math.abs(rows[0].net)) * 100 : 0;
      var up = change >= 0;
      d.className = 'kpi__delta ' + (up ? 'is-up' : 'is-down');
      d.innerHTML = '<span aria-hidden="true">' + (up ? '▲' : '▼') + '</span> ' +
        F.money(Math.abs(change)) + ' (' + (up ? '+' : '−') + Math.abs(pct).toFixed(1) + '%) ' +
        '<span class="kpi__since">since ' + F.month(rows[0].date) + '</span>';
    } else {
      d.className = 'kpi__delta'; d.textContent = 'Save a second snapshot to see change over time.';
    }

    $('trend-sub').textContent = rows.length
      ? rows.length + ' snapshot' + (rows.length === 1 ? '' : 's') + ', ' +
        F.month(rows[0].date) + ' to ' + F.month(rows[rows.length - 1].date)
      : 'No snapshots yet.';

    renderSeriesToggles();
    C.trend($('chart-trend'), rows, { shape: state.shape, series: state.series });
    $('trend-cap').textContent = captionFor(rows);
    renderTrendTable(rows);

    var mix = S.byCategory(state.side);
    var mixTotal = mix.reduce(function (s, i) { return s + i.value; }, 0);
    $('mix-sub').textContent = mix.length
      ? F.money(mixTotal) + ' across ' + mix.length + ' categor' + (mix.length === 1 ? 'y' : 'ies')
      : 'Add an account to see the breakdown.';
    C.bars($('chart-mix'), mix, { empty: 'No ' + (state.side === 'asset' ? 'assets' : 'liabilities') + ' added yet.' });

    renderAccounts();
    renderExpenses();
  }

  function captionFor(rows) {
    if (rows.length < 2) return '';
    var on = state.series.filter(function (s) { return s.on; }).map(function (s) { return s.label; });
    return on.join(', ') + ' — ' + F.month(rows[0].date) + ' to ' + F.month(rows[rows.length - 1].date) + '.';
  }

  function renderSeriesToggles() {
    var host = $('series-toggles');
    host.innerHTML = '';
    state.series.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'skey' + (s.on ? ' is-on' : '');
      b.setAttribute('aria-pressed', s.on ? 'true' : 'false');
      b.innerHTML = '<span class="skey__swatch" style="background:var(' + s.varName + ')"></span>' + s.label;
      b.addEventListener('click', function () {
        var onCount = state.series.filter(function (x) { return x.on; }).length;
        if (s.on && onCount === 1) { toast('Keep at least one series on.'); return; }
        state.series[i].on = !s.on;
        render();
      });
      host.appendChild(b);
    });
  }

  function renderTrendTable(rows) {
    var host = $('table-trend');
    if (!rows.length) { host.innerHTML = ''; return; }
    host.innerHTML =
      '<table class="dt"><thead><tr><th>Date</th><th>Net worth</th><th>Assets</th><th>Liabilities</th></tr></thead><tbody>' +
      rows.slice().reverse().map(function (r) {
        return '<tr><td>' + r.date + '</td><td>' + F.money(r.net) + '</td><td>' +
               F.money(r.assets) + '</td><td>' + F.money(r.liabilities) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- accounts ---------- */
  function renderAccounts() {
    [['asset', 'Assets'], ['liability', 'Liabilities']].forEach(function (pair) {
      var kind = pair[0];
      var host = $('accounts-' + kind);
      var list = S.accountsOf(kind);
      if (!list.length) { host.innerHTML = ''; return; }

      host.innerHTML = '<p class="accounts__head">' + pair[1] + '</p>' +
        list.map(function (a) {
          return '<div class="acct" data-id="' + a.id + '">' +
            '<span class="acct__name">' + esc(a.name) + '<span class="acct__cat">' + esc(a.category) + '</span></span>' +
            '<input class="input input--num acct__input" type="number" step="0.01" value="' + a.value + '" aria-label="Balance for ' + esc(a.name) + '">' +
            '<button class="linkbtn" type="button" data-remove="' + a.id + '" aria-label="Remove ' + esc(a.name) + '">Remove</button>' +
          '</div>';
        }).join('');

      host.querySelectorAll('.acct__input').forEach(function (input) {
        input.addEventListener('change', function () {
          S.updateAccount(input.closest('.acct').dataset.id, input.value);
          render();
        });
      });
      host.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var a = S.accountById(btn.dataset.remove);
          if (!a) return;
          if (!confirm('Remove "' + a.name + '"? This also drops it from past snapshots.')) return;
          S.removeAccount(btn.dataset.remove);
          render();
        });
      });
    });
  }

  function fillCategorySelect() {
    var sel = $('sel-category');
    sel.innerHTML =
      '<optgroup label="Assets">' + S.ASSET_CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</optgroup>' +
      '<optgroup label="Liabilities">' + S.LIABILITY_CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</optgroup>';
    $('sel-exp-category').innerHTML = S.EXPENSE_CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('');
  }

  /* ---------- expenses ---------- */
  function renderExpenses() {
    var on = !!S.settings().expenses;
    $('toggle-expenses').checked = on;
    $('expenses-body').hidden = !on;
    if (!on) return;

    var stats = S.expenseStats();
    $('exp-month').textContent = F.money(stats.month);
    $('exp-avg').textContent   = F.money(stats.average);

    C.bars($('chart-expenses'), S.expensesByCategory(stats.monthKey), { empty: 'No expenses logged this month.' });

    var recent = S.all().expenses.slice(0, 12);
    $('table-expenses').innerHTML = recent.length
      ? '<table class="dt"><thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th><th></th></tr></thead><tbody>' +
        recent.map(function (e) {
          return '<tr><td>' + e.date + '</td><td>' + esc(e.category) + '</td><td>' + esc(e.note) + '</td><td>' +
                 F.money(e.amount) + '</td><td><button class="linkbtn" type="button" data-exp="' + e.id + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table>'
      : '';

    $('table-expenses').querySelectorAll('[data-exp]').forEach(function (b) {
      b.addEventListener('click', function () { S.removeExpense(b.dataset.exp); render(); });
    });
  }

  /* ---------- segmented controls ---------- */
  function wireSegmented(selector, attr, apply) {
    document.querySelectorAll(selector).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.parentElement;
        group.querySelectorAll('.seg').forEach(function (b) { b.classList.remove('is-on'); });
        btn.classList.add('is-on');
        apply(btn.getAttribute(attr));
        render();
      });
    });
  }

  /* ---------- import / export ---------- */
  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function doExport() {
    download('net-worth-' + S.todayISO() + '.json', S.exportJSON());
    toast('Exported. The file is yours — nothing was uploaded.');
  }

  /* ---------- init ---------- */
  function init() {
    fillCategorySelect();
    S.load();
    route();

    $('btn-demo').addEventListener('click', function () { S.seedDemo(); route(); toast('Sample data loaded. Delete it any time.'); });
    $('btn-start').addEventListener('click', function () {
      S.wipe(); S.addAccount('Checking', 'Cash', 0);
      route(); toast('Add your accounts, then save a snapshot.');
    });

    wireSegmented('[data-range]', 'data-range', function (v) { state.range = +v; });
    wireSegmented('[data-shape]', 'data-shape', function (v) { state.shape = v; });
    wireSegmented('[data-side]',  'data-side',  function (v) { state.side = v; });

    $('form-account').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      S.addAccount(f.name.value.trim(), f.category.value, f.value.value);
      f.reset(); render(); toast('Account added.');
    });

    $('btn-snapshot').addEventListener('click', function () {
      var d = S.saveSnapshot();
      render(); toast('Snapshot saved for ' + d + '.');
    });

    $('toggle-expenses').addEventListener('change', function (e) {
      S.setSetting('expenses', e.target.checked); renderExpenses();
    });

    $('form-expense').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      S.addExpense(f.date.value, f.category.value, f.amount.value, f.note.value.trim());
      var keepDate = f.date.value;
      f.reset(); f.date.value = keepDate;
      render(); toast('Expense added.');
    });

    $('btn-export').addEventListener('click', doExport);
    $('btn-export-2').addEventListener('click', doExport);

    $('btn-import').addEventListener('click', function () { $('file-import').click(); });
    $('file-import').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { S.importJSON(reader.result); route(); toast('Imported.'); }
        catch (err) { toast('That file could not be read as a Net Worth export.'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('btn-wipe').addEventListener('click', function () {
      if (!confirm('Delete every account, snapshot, and expense from this browser? This cannot be undone.')) return;
      S.wipe(); route(); toast('Deleted. Nothing is left behind.');
    });

    // default the expense date field to today
    var ed = document.querySelector('#form-expense [name="date"]');
    if (ed) ed.value = S.todayISO();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (!$('dashboard').hidden) render(); }, 160);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
