# austinwilkins.dev

Personal portfolio site. Plain HTML, CSS, and JavaScript — no framework, no build step,
no installs. **Double-click `index.html`** and it opens in your browser, fully working.

```
austinwilkins-dev/
├── index.html              the whole site (one page, anchor navigation)
│                           sections: About · Capabilities · Work · Stack · Contact
├── assets/
│   ├── css/styles.css      design system — all tokens live in :root at the top
│   ├── js/main.js          theme toggle, typewriter, scroll reveals, nav state
│   └── img/                images go here
├── resume/                 resume PDF
├── net-worth/              the Net Worth Tracker tool (its own README inside)
├── favicon.svg
├── robots.txt
└── sitemap.xml
```

---

## Adding a project

Open `index.html`, find the `<div class="cards">` block, copy any one `<article class="card">`,
and edit it. That is the only place project content lives — nothing else to update.

```html
<article class="card reveal">
  <header class="card__head">
    <span class="status is-live"><span class="status__dot"></span>Live</span>
    <span class="mono card__year">2026</span>
  </header>
  <h3 class="card__title">Project name</h3>
  <p class="card__desc">Two or three sentences. What it does, and what was hard about it.</p>
  <ul class="tags">
    <li>Python</li><li>Cloudflare</li>
  </ul>
  <div class="card__links">
    <a class="card__link" href="https://example.com">Live site ↗</a>
    <a class="card__link" href="https://github.com/...">Source ↗</a>
  </div>
</article>
```

**Status options** — change both the class and the label text:

| Class | Label | Colour |
|---|---|---|
| `is-live` | Live | green |
| `is-progress` | Active | orange |
| `is-planned` | Planned | grey |

Delete any `<a class="card__link">` line for a link you do not have yet. The cards reflow
on their own — three, four, seven projects all lay out correctly with no CSS changes.

---

## Changing the look

Every colour, font, and spacing value is a token at the top of `assets/css/styles.css`:

```css
:root {
  --bg:     #121418;   /* page background            */
  --text:   #ecedef;   /* body text                  */
  --accent: #e5643c;   /* the one signal colour      */
  ...
}
```

Change `--accent` and the whole site re-themes — buttons, links, section numbers, the
hero caret, hover states. The `[data-theme="light"]` block below it does the same for
light mode. Dark is the default; the toggle in the header switches and remembers the choice.

To change the rotating line under your name, edit the `PHRASES` array at the top of
`assets/js/main.js`.

---

## Before this goes live — the TODO list

Search `index.html` for `TODO`. Every one is marked.

- [x] **GitHub URL** — `github.com/A-Wilkins`
- [x] **LinkedIn URL** — `linkedin.com/in/austin-r-wilkins`
- [x] **Resume PDF** — in place, scanned clean for hidden text (10pt/12pt only, no white fills)
- [x] **Location** — Naples, Florida
- [x] **Live URL for HyperLocalHomes** — hyperlocalhomes.com
- [x] **Live URL for Omega National Title** — omeganationaltitle.com
- [x] **Live URL for My Local Everything** — mylocaleverything.com
- [ ] **OG image** — `assets/img/og-card.png`, 1200×630, for link previews in Slack/LinkedIn/iMessage
- [ ] **Confirm the project descriptions** are how you want the work characterised

---

## Publishing

Hosted on Cloudflare Pages under the personal Cloudflare account (`awilkins012@gmail.com`) —
the same account that holds the `austinwilkins.dev` registration. Both have to be in that
account for the custom domain to attach.

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → connect the repo.
3. Build command: **leave empty**. Output directory: **`/`**. It is already static.
4. Project → Custom domains → add `austinwilkins.dev` and `www.austinwilkins.dev`.

Cloudflare writes the DNS records and issues the certificate itself. Note that `.dev` is
HSTS-preloaded, so the site is HTTPS-only by force — that is automatic here, but a plain
`http://` link to it will not resolve.
