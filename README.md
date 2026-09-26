# AP-SQL Assistant — V13.1

A full TypeScript + Vite evolution of the V11.9 baseline: navigation moved into a proper Hamburger Menu, "Admin"
renamed to "Settings" (same functionality, same password), and a brand-new **Manual Schema Editor** with full
CRUD and a real three-level delete confirmation — all sharing one consistent schema state with the Query
Builder, AI engines, and Error Rectifier.

## Just want to open it? `dist/index.html`

Fully self-contained (~150 KB, zero external `<script>`/`<link>` references). Double-click it — no server, no
build step. Verified via `file://` in a real headless browser with **zero console errors, zero page errors**.

## What's new in V13.1

- **Hamburger Menu is now the primary nav** — Quick Start, Query Builder (▸ Read Only / CR), Schema (▸ Used
  Schema / Manual Schema Editor), Error Rectifier, Settings, About. Opens/closes correctly at every width from
  375px to 1920px; closes on outside-click and Escape; nested groups expand in place.
- **Admin → Settings** — same operational password mechanism (now SHA-256 hashed via the browser's built-in
  Web Crypto API — never stored or logged in plain text), plus Change Password, Forgot Password/reset, and the
  same Schema Management + Danger Zone functionality, reachable from both Settings and Used Schema (same
  underlying code, not duplicated).
- **Manual Schema Editor** (flagship new feature) — Select Schema → scrollable/searchable/paginated data grid
  (one row per column, 50 rows/page so large schemas never freeze the browser) → Add/Edit via a validated form
  modal → Delete via a genuine **three-level confirmation** (plain confirm → detailed record confirm → operational
  password confirm). Every save runs through a schema-integrity validator first (duplicate columns, invalid
  types, broken FK references, etc.) — if validation fails, the real schema is left completely untouched.
- **Full integration confirmed** — a column added via the Manual Schema Editor to the *active* schema was
  verified, in a live browser test, to immediately appear in the Read Only Query Builder's column picker and in
  generated SQL, with no page reload required.

## Verified before packaging

| Check | Result |
|---|---|
| `tsc --noEmit` | **0 errors** across all 42 source files |
| `vite build` | Clean production bundle |
| Hamburger menu: open, nested group expand, Escape-to-close | ✅ |
| All 8 routes render correct content | ✅ |
| Read Only Builder — table/column select → generated SQL | ✅ |
| CR Builder — DELETE without WHERE correctly blocked | ✅ |
| Settings — wrong password rejected, correct password accepted, reset works | ✅ |
| Manual Schema Editor — Add row, Edit row (persisted), Delete flow (3 confirmations, wrong password blocked, correct password succeeds, row actually removed) | ✅ |
| **Schema Editor → Query Builder propagation** — new column appears in column picker AND generated SQL immediately | ✅ **confirmed live** |
| Error Rectifier — ORA-00904 correctly diagnosed | ✅ |
| Mobile (390px) — hamburger opens, zero horizontal overflow | ✅ |
| Console/page errors across the entire test run | **None** |

## What's in this zip

```
apsql/
├── dist/index.html      ← Open this. Fully self-contained.
├── src/                  ← Full TypeScript source (42 files)
│   ├── engines/          sqlEngine, crEngine, nlpEngine, validationEngine, errorRectifierEngine,
│   │                     optimizeEngine, decodeEngine, filterEngine, schemaIntegrityEngine (NEW)
│   ├── services/         aiService, schemaService (extended), passwordService (NEW)
│   ├── components/       hamburgerNav (NEW), dataTable (NEW), modal (NEW), + existing pickers/tabs/etc.
│   └── pages/            schemaEditorPage (NEW), settingsPage (NEW), + existing pages
├── public/favicon.svg
├── package.json / tsconfig.json / vite.config.ts
└── README.md
```

## Rebuilding from source

```bash
npm install vite typescript --no-save   # requires npm registry access
npm run build                            # tsc --noEmit + vite build → dist/
```

## Demo credentials

Operational password: `apsql-admin` (Settings → Security). Change or reset it from the same page.
