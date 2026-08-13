# Net Worth Tracker

A net worth tracker that runs entirely in the browser. No account, no server,
no network requests. Plain HTML, CSS, and JavaScript — no framework, no build
step, no dependencies. **Double-click `index.html`** and it works.

```
networth-tracker/
├── index.html
├── assets/
│   ├── css/app.css       design tokens + layout (light/dark in :root)
│   └── js/
│       ├── store.js      data model, localStorage, derived totals
│       ├── charts.js     hand-built SVG charts
│       └── app.js        UI wiring
└── favicon.svg
```

---

## The privacy claim, and why it is literally true

Most "private" finance apps mean *"we promise not to look."* This one has no
server to look with. Everything is held in `localStorage` under a single key
(`nw.data.v1`) and never leaves the machine.

That is verifiable, not marketing. Loading the page makes **five requests** —
its own HTML, CSS, three scripts, and the favicon — and **zero** to anywhere
else:

```js
performance.getEntriesByType('resource')
  .filter(r => !r.name.startsWith(location.origin))   // → []
```

This is why the app uses the **system font stack instead of a webfont**. Pulling
Inter from Google Fonts would hand a third party the visitor's IP address on
every page load, which would make the claim false. No CDN, no analytics, no
telemetry, no error reporting.

Consequences worth understanding:

- Clearing browser data **deletes it**. Export first.
- Data does not sync between devices or browsers. Move it with Export → Import.
- Nothing can be recovered by anyone if it is lost. There is no backup.

---

## Features

**Net worth** — add asset and liability accounts, update balances, and save a
snapshot. Net worth is assets minus liabilities, tracked over time. Saving twice
in one day overwrites rather than duplicating.

**Customizable charts**

| Control | Options |
|---|---|
| Time range | 6M · 1Y · 2Y · All |
| Chart type | Area · Line · Bars |
| Series | Net worth · Assets · Liabilities (any combination) |
| Breakdown | Assets or Liabilities, by category |

The trend chart has a crosshair tooltip; the breakdown bars show value and share
of total. Every chart has a table view.

**Expenses** — off by default. Turn it on and you get monthly total, monthly
average, spend by category, and a recent-transactions list.

**Your data** — Export writes a plain JSON file you own. Import reads it back.
Delete everything wipes the key.

---

## Chart design

Colors are not decorative and were not picked by eye. Forms follow the data's
job: trend over time is a line/area, magnitude comparison is horizontal bars on
a **single-hue sequential ramp** (darker/brighter = larger).

The three categorical series use validated slots 1–3 (blue, orange, aqua),
stepped separately for each mode and checked against the exact surfaces the app
renders on (`#ffffff` light, `#191c21` dark):

| Series | Light | Dark |
|---|---|---|
| Net worth | `#2a78d6` | `#3987e5` |
| Assets | `#eb6834` | `#d95926` |
| Liabilities | `#1baf7a` | `#199e70` |

All-pairs colorblind separation passes in both modes (worst ΔE 9.2 light / 9.4
dark against a floor of 8; normal-vision worst 24.0 / 20.9 against a floor of
15). One flag: light-mode aqua sits at **2.82:1** against white, under the 3:1
line — so the chart ships visible direct labels, a legend, and a table view, and
never leans on color alone to carry identity.

The sequential bar ramp is clamped so the smallest bar stays visible: no lighter
than step 250 in light mode, no darker than step 600 in dark.

---

## Deploying

It is static and every path is relative, so it runs at any mount point with no
code change:

- **Subfolder of an existing site** — copy the folder in; it serves at
  `/networth-tracker/` or wherever you put it.
- **Its own Cloudflare Pages project** — connect the repo, empty build command,
  output directory `/`, then attach a domain or subdomain.

No build step, no environment variables, no server-side anything.

---

## Extending it

- **Categories** — the three arrays at the top of `store.js`
  (`ASSET_CATEGORIES`, `LIABILITY_CATEGORIES`, `EXPENSE_CATEGORIES`).
- **Currency** — `Fmt.money` in `charts.js`; `settings.currency` is already in
  the data model and unused.
- **Colors** — the `:root` and `:root[data-theme="light"]` blocks in `app.css`.
  If you change a series color, re-run the palette validator against both
  surfaces rather than trusting your eye.
- **Storage** — `store.js` is the only file that touches `localStorage`. Swapping
  it for IndexedDB or an encrypted store means changing `load`/`save` and nothing
  else.
