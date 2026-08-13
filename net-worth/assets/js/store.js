/* =========================================================================
   store.js — data model, persistence, derived values.
   Everything lives in localStorage. There is no network layer by design.
   ========================================================================= */
window.Store = (function () {
  'use strict';

  var KEY = 'nw.data.v1';

  var ASSET_CATEGORIES = ['Cash', 'Investments', 'Retirement', 'Property', 'Vehicle', 'Other asset'];
  var LIABILITY_CATEGORIES = ['Credit card', 'Student loan', 'Mortgage', 'Auto loan', 'Other debt'];
  var EXPENSE_CATEGORIES = ['Housing', 'Food', 'Transport', 'Utilities', 'Health', 'Fun', 'Other'];

  function blank() {
    return { version: 1, accounts: [], snapshots: [], expenses: [], settings: { currency: 'USD', expenses: false } };
  }

  var data = blank();

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.accounts)) return false;
      data = {
        version: 1,
        accounts: parsed.accounts || [],
        snapshots: parsed.snapshots || [],
        expenses: parsed.expenses || [],
        settings: Object.assign({ currency: 'USD', expenses: false }, parsed.settings || {})
      };
      return true;
    } catch (e) {
      return false;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      // quota or private mode — surface it rather than failing silently
      return false;
    }
  }

  /* ---------- accounts ---------- */
  function addAccount(name, category, value) {
    var kind = LIABILITY_CATEGORIES.indexOf(category) > -1 ? 'liability' : 'asset';
    var acct = { id: uid(), name: name, category: category, kind: kind, value: Math.abs(Number(value) || 0) };
    data.accounts.push(acct);
    save();
    return acct;
  }

  function updateAccount(id, value) {
    var a = accountById(id);
    if (!a) return;
    a.value = Math.abs(Number(value) || 0);
    save();
  }

  function removeAccount(id) {
    data.accounts = data.accounts.filter(function (a) { return a.id !== id; });
    data.snapshots.forEach(function (s) { delete s.values[id]; });
    save();
  }

  function accountById(id) {
    for (var i = 0; i < data.accounts.length; i++) if (data.accounts[i].id === id) return data.accounts[i];
    return null;
  }

  function accountsOf(kind) {
    return data.accounts.filter(function (a) { return a.kind === kind; });
  }

  /* ---------- totals ---------- */
  function totals() {
    var assets = 0, liabilities = 0;
    data.accounts.forEach(function (a) {
      if (a.kind === 'asset') assets += a.value; else liabilities += a.value;
    });
    return { assets: assets, liabilities: liabilities, net: assets - liabilities };
  }

  /* ---------- snapshots ---------- */
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // One snapshot per date: saving twice in a day overwrites rather than duplicating.
  function saveSnapshot(dateISO) {
    var date = dateISO || todayISO();
    var values = {};
    data.accounts.forEach(function (a) { values[a.id] = a.value; });

    var existing = null;
    for (var i = 0; i < data.snapshots.length; i++) if (data.snapshots[i].date === date) existing = data.snapshots[i];

    if (existing) {
      existing.values = values;
    } else {
      data.snapshots.push({ id: uid(), date: date, values: values });
    }
    data.snapshots.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    save();
    return date;
  }

  // Snapshots resolved into { date, assets, liabilities, net }, oldest first.
  function series(monthsBack) {
    var rows = data.snapshots.map(function (s) {
      var assets = 0, liabilities = 0;
      Object.keys(s.values).forEach(function (accId) {
        var a = accountById(accId);
        if (!a) return;                       // account deleted since
        var v = Number(s.values[accId]) || 0;
        if (a.kind === 'asset') assets += v; else liabilities += v;
      });
      return { date: s.date, assets: assets, liabilities: liabilities, net: assets - liabilities };
    });

    if (monthsBack && monthsBack > 0) {
      var cut = new Date();
      cut.setMonth(cut.getMonth() - monthsBack);
      var cutISO = cut.toISOString().slice(0, 10);
      rows = rows.filter(function (r) { return r.date >= cutISO; });
    }
    return rows;
  }

  function byCategory(kind) {
    var map = {};
    accountsOf(kind).forEach(function (a) {
      map[a.category] = (map[a.category] || 0) + a.value;
    });
    return Object.keys(map)
      .map(function (k) { return { label: k, value: map[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /* ---------- expenses ---------- */
  function addExpense(dateISO, category, amount, note) {
    var e = { id: uid(), date: dateISO, category: category, amount: Math.abs(Number(amount) || 0), note: note || '' };
    data.expenses.push(e);
    data.expenses.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    save();
    return e;
  }

  function removeExpense(id) {
    data.expenses = data.expenses.filter(function (e) { return e.id !== id; });
    save();
  }

  function expensesByCategory(monthKey) {
    var map = {};
    data.expenses.forEach(function (e) {
      if (monthKey && e.date.slice(0, 7) !== monthKey) return;
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.keys(map)
      .map(function (k) { return { label: k, value: map[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  function expenseStats() {
    var thisMonth = todayISO().slice(0, 7);
    var monthTotal = 0, byMonth = {};
    data.expenses.forEach(function (e) {
      var m = e.date.slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + e.amount;
      if (m === thisMonth) monthTotal += e.amount;
    });
    var months = Object.keys(byMonth);
    var avg = months.length
      ? months.reduce(function (sum, m) { return sum + byMonth[m]; }, 0) / months.length
      : 0;
    return { month: monthTotal, average: avg, monthKey: thisMonth };
  }

  /* ---------- settings, io, lifecycle ---------- */
  function setSetting(k, v) { data.settings[k] = v; save(); }

  function exportJSON() {
    return JSON.stringify(data, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.accounts)) throw new Error('Not a Net Worth export file.');
    data = {
      version: 1,
      accounts: parsed.accounts,
      snapshots: parsed.snapshots || [],
      expenses: parsed.expenses || [],
      settings: Object.assign({ currency: 'USD', expenses: false }, parsed.settings || {})
    };
    save();
  }

  function wipe() {
    data = blank();
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  function hasData() {
    return data.accounts.length > 0 || data.snapshots.length > 0 || data.expenses.length > 0;
  }

  /* ---------- demo data (clearly fictional) ---------- */
  function seedDemo() {
    data = blank();
    var defs = [
      ['Checking',          'Cash',         4200],
      ['Emergency savings', 'Cash',        12500],
      ['Brokerage',         'Investments', 38400],
      ['401(k)',            'Retirement',  61200],
      ['Condo',             'Property',   285000],
      ['Car',               'Vehicle',     16800],
      ['Visa',              'Credit card',  1850],
      ['Student loan',      'Student loan',14300],
      ['Mortgage',          'Mortgage',   214000],
      ['Auto loan',         'Auto loan',    9600]
    ];
    defs.forEach(function (d) { addAccount(d[0], d[1], d[2]); });

    // 18 months of plausible history, ending at today's balances
    var now = new Date();
    for (var i = 17; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
      var values = {};
      data.accounts.forEach(function (a) {
        // Rates chosen so the sample reads as a plausible 18 months
        // (~30% net worth growth), not a fantasy.
        var drift, wobble = 1 + (Math.sin(i * 1.7 + a.name.length) * 0.012);
        if (a.kind === 'asset') {
          drift = a.category === 'Property' ? 1 - i * 0.003   // appreciates slowly
                : a.category === 'Vehicle'  ? 1 + i * 0.010   // depreciates
                : 1 - i * 0.006;                              // savings & investments grow
        } else {
          drift = 1 + i * 0.005;                              // debts were larger in the past
        }
        values[a.id] = Math.max(0, Math.round(a.value * drift * wobble));
      });
      data.snapshots.push({ id: uid(), date: iso, values: values });
    }

    var cats = EXPENSE_CATEGORIES;
    for (var m = 0; m < 3; m++) {
      for (var n = 0; n < 9; n++) {
        var ed = new Date(now.getFullYear(), now.getMonth() - m, 2 + n * 3);
        if (ed > now) continue;
        var iso2 = ed.getFullYear() + '-' + String(ed.getMonth() + 1).padStart(2, '0') + '-' + String(ed.getDate()).padStart(2, '0');
        var cat = cats[(n + m) % cats.length];
        var base = { Housing: 1450, Food: 190, Transport: 95, Utilities: 145, Health: 80, Fun: 120, Other: 60 }[cat];
        data.expenses.push({ id: uid(), date: iso2, category: cat, amount: Math.round(base * (0.8 + Math.random() * 0.5)), note: '' });
      }
    }
    data.expenses.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    data.settings.expenses = true;
    save();
  }

  return {
    ASSET_CATEGORIES: ASSET_CATEGORIES,
    LIABILITY_CATEGORIES: LIABILITY_CATEGORIES,
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    load: load, save: save, hasData: hasData, wipe: wipe,
    all: function () { return data; },
    settings: function () { return data.settings; }, setSetting: setSetting,
    addAccount: addAccount, updateAccount: updateAccount, removeAccount: removeAccount,
    accountsOf: accountsOf, accountById: accountById,
    totals: totals, series: series, byCategory: byCategory,
    saveSnapshot: saveSnapshot, todayISO: todayISO,
    addExpense: addExpense, removeExpense: removeExpense,
    expensesByCategory: expensesByCategory, expenseStats: expenseStats,
    exportJSON: exportJSON, importJSON: importJSON, seedDemo: seedDemo
  };
})();
