# AP-SQL Assistant — V12.0 (TypeScript + Vite)

A client-side only SQL-generation tool for AP/P2P support teams: Read Only Query Builder, Query Builder for Change
Requests, a schema-aware Error Rectifier, an editable/importable schema, a Guided Walkthrough, and a System / Light /
Dark theme. It never opens a database connection and never executes SQL — every statement is produced as text for
human review.

**This build was tested in a real headless Chromium browser** (Playwright) — every route, every button, the
mandatory-WHERE guard on UPDATE/DELETE, the Error Rectifier, dark/light theme, the mobile hamburger menu, and the
Guided Walkthrough — with **zero console errors and zero JavaScript exceptions**, in both delivery formats below.

## Which file do I use? (pick one — all three work)

### 1. `dist/ap-sql-assistant-standalone.html` — just works, anywhere, no setup
A single self-contained HTML file (~78 KB) with all CSS and JavaScript inlined directly into it. No build step, no
server, no dependencies.
- **Double-click it** on your PC and it opens straight in your browser — tested and confirmed working over
  `file://` directly (this is what previously failed with the multi-file build, because browsers block loading
  separate `.js` module files from `file://` for security reasons — inlining everything into one file avoids that
  entirely).
- **Upload it as-is** to any host: GitHub Pages, Netlify, Vercel, SharePoint, a OneDrive share link, an internal file
  server — anywhere that can serve or open an `.html` file.
- Recommended if you just want something that works right now with zero friction.

### 2. `dist/` (the whole folder: `index.html` + `assets/app.js` + `assets/app.css` + `favicon.svg`)
The standard multi-file static build. Use this if you're hosting on GitHub Pages, Netlify, Vercel, or any static web
server (needs `http(s)://`, not `file://`). Confirmed working via a local HTTP server with zero console errors.

### 3. `src/` + `.github/workflows/deploy.yml` — full TypeScript source, for ongoing development
The complete Vite + TypeScript project so you (or anyone on the team) can keep developing the tool, plus a ready
GitHub Actions workflow that rebuilds and redeploys `dist/` to GitHub Pages automatically on every push to `main`.

## Recommended folder layout on your machine

Based on your project location, drop this into:

```
C:\Users\subhamain\OneDrive - Basware Corp\Desktop\Project\AP-SQL-Assistant-V12.0\
├── dist\
│   ├── ap-sql-assistant-standalone.html   ← double-click this to use it immediately
│   ├── index.html
│   ├── favicon.svg
│   └── assets\
│       ├── app.js
│       └── app.css
├── src\                                     ← full TypeScript source
├── .github\workflows\deploy.yml              ← GitHub Actions → GitHub Pages
├── package.json / tsconfig.json / vite.config.ts
└── README.md (this file)
```

## Hosting it on GitHub (public or private repo, e.g. `sk-ap-sql-assistant`)

**Fastest option (no build, no Actions):** commit `dist/ap-sql-assistant-standalone.html` to any repo, then either:
- Open it directly from the repo via "raw" view / download, or
- Enable GitHub Pages (**Settings → Pages → Source → "Deploy from a branch"** → `main` → `/dist`) and it will be
  served at `https://<user-or-org>.github.io/<repo>/ap-sql-assistant-standalone.html`.

**Automated option (rebuilds on every push):**
1. Push the whole project (including `.github/`) to your repo's `main` branch.
2. **Settings → Pages → Build and deployment → Source → "GitHub Actions"** (important: not "Deploy from a branch").
3. The included workflow (`.github/workflows/deploy.yml`) will type-check, build, and publish `dist/` automatically
   — no personal token or `gh-pages` branch needed, it uses the repo's built-in `GITHUB_TOKEN`.
4. Works on **both public and private repos** — GitHub Pages via Actions supports private repos too (Pages will be
   private/restricted-access unless the repo is public).

If you'd rather not touch GitHub Actions/npm at all, the standalone HTML file removes that dependency entirely —
just host the one file.

## Local development (optional — only needed if you want to edit the source)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build       # tsc --noEmit + vite build → dist/
npm run preview     # serve the production build at http://localhost:4173
```

## What was tested before delivery

| Test | Result |
|---|---|
| `tsc -p tsconfig.json --noEmit` | 0 type errors |
| `vite build` | Clean bundle, single `app.js` + `app.css` |
| Standalone HTML via `file://` (double-click simulation) | All 7 routes render, 0 console errors, 0 page errors |
| `dist/` via local HTTP server (GitHub Pages simulation) | All 7 routes render, 0 console errors, 0 page errors |
| Read Only Query Builder | Table → column → join → filter → sort → limit all produce correct SQL live |
| Query Builder for CR | DELETE/UPDATE correctly **blocked** with no WHERE, correctly **unblocked** once a filter is added |
| Error Rectifier | `ORA-00904` error correctly parsed → corrected SQL + plain-language explanation |
| Theme | Dark/Light/System toggle persists and updates immediately |
| Schema search | Filters tables/columns correctly (tested exclusion of non-matching tables) |
| Schema Update password gate | Wrong password blocked with visible error; correct password unlocks |
| Guided Walkthrough | Spotlight + popup renders and steps through correctly |
| Mobile (390px viewport) | Hamburger menu appears and layout reflows correctly |

## Demo schema & password

- Embedded schema covers **Purchase Orders, Invoices, Vendors, General Ledger, and Users & Approvals** (8 tables).
- Update Schema demo password: `apsql-admin`. Download the active schema as JSON/CSV, import a new JSON schema, or
  reset to default. Everything lives in the browser's `localStorage` — nothing is sent anywhere, ever.
