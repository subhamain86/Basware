# AP-SQL Assistant — Version 10.1

A schema-aware SQL generator. Version 10.1 makes "Describe What You Need"
a first-class way to build a query — not just a note field that gets
mentioned in the output — in both the Read Only Query Builder and the
Query Builder for CR.

Open `index.html` directly in any modern browser. **Requires internet
access** to load Bootstrap 5.3, Bootstrap Icons, and Google Fonts from
their CDNs. No build step, server, or local package installation is
required.

Crafted by Subham Ain.

## What changed in Version 10.1

### 1. "Describe What You Need" now has its own Build Query button
In both builders, the "Describe What You Need" card now has its own
**Build Query** button directly beneath it. Clicking it — or the
pre-existing Build Query button below the tabs, which now behaves
identically — builds a query using:

- **The description alone**, with nothing selected manually at all;
- **Manual selections alone**, exactly as before, with no description
  text (zero change in behavior for existing workflows); or
- **Both together**, where manual choices always take precedence and the
  description only ever fills in genuine gaps.

For example, in the Read Only Query Builder, typing *"overdue invoices
for a supplier in the last 30 days, show invoice number, gross amount and
due date"* into the description box and clicking Build Query — with
nothing ticked anywhere else — produces a complete, validated query:
matching the `IA_INVOICE` table, the `INVOICE_NUMBER`, `GROSS_SUM` (via
its alias "Amount"), and `DUE_DATE` columns, and a `DUE_DATE >= <30 days
ago>` filter, all derived purely from the sentence.

In the Query Builder for CR, typing *"update the invoice status to 40
where invoice id is 123"* and clicking Build Query — again with nothing
selected manually — switches the Query Type selector to UPDATE, picks the
`IA_INVOICE` table, sets `STATUS = 40`, and adds the `INVOICE_ID = 123`
WHERE condition, then builds the exact same validated SQL as if every
step had been clicked by hand. The mandatory WHERE-condition safety net
is never bypassed by a description alone — describing an UPDATE or DELETE
with no WHERE-style clause still requires the explicit override checkbox,
exactly as before.

After a description-driven build, an **"Interpreted from your
description"** summary appears beneath the description box, listing
exactly what was matched (tables, columns, filters, sort, limit, and so
on), and every affected part of the manual UI (checkboxes, the Pick Table
dropdown, filter rows, the Query Type selector) visibly updates to match
— so what got picked up from the description is never a mystery, and can
be reviewed or adjusted before building again.

### 2. New module: `nl-query-engine.js`
A new, pure, dependency-light interpretation module reads the description
text and matches it against the **active schema only** — table names,
column names, aliases, and module labels — with no hard-coded
business-domain synonyms, exactly consistent with how Decode and the
Error Rectifier already treat the schema as the single source of truth.
It recognizes:

- Table and column mentions (including by alias, e.g. "gross amount" for
  a column aliased "Amount").
- Filter phrasings: equals/is, not equal, contains, starts with, ends
  with, greater/less than (and or-equal-to variants), and between.
- **Decode-aware filtering** — a plain-language status word like
  "approved" is matched against the column's actual schema-defined decode
  labels and translated into the correct underlying code.
- "last N days" against the best available date/timestamp column.
- Sort phrasing ("sorted by X descending"/"newest first"/etc.), "top N"
  limits, and "unique"/"no duplicates" for DISTINCT.
- Hierarchy/org-chart intent, including disambiguating between multiple
  self-referencing tables in the schema by word-overlap when the phrase
  doesn't name one exactly (e.g. "reporting chain for users" resolves to
  the table whose name relates to "users", not a different
  self-referencing table for "suppliers").
- For Change Requests: Query Type detection (INSERT/UPDATE/DELETE) from
  whichever command keyword appears first, plus `SET X to Y` / `X = Y` /
  `X is Y` value assignments and `WHERE`-style filter phrasing — carefully
  segmented at the word "where" so a WHERE-clause column is never
  mistaken for an assignment target, or vice versa.

If nothing can be confidently matched, the interpretation is honestly
empty (with a plain-language note explaining why) rather than guessing —
the same "do not invent" principle already used throughout this
application.

### 3. Zero changes to the core query-generation engines
The interpretation is applied by mutating the **exact same** UI state
(`selectedTables`, column checkboxes, filter conditions, sort rows, the
CR command/table/columns/filters) that manual clicking already
populates, then falling through to the completely unmodified
`generateSql()` / `buildCrQuery()` pipeline. This means `sql-engine.js`,
`cr-engine.js`, `decode-engine.js`, `filter-engine.js`, and
`validation-engine.js` required **no changes whatsoever** for this
release — dramatically reducing regression risk, and confirmed by 141/141
pre-existing unit tests continuing to pass unmodified.

## Project structure
```
ap-sql-assistant/
  index.html                 Application shell — adds a Build Query button + an
                                "Interpreted from your description" box to both
                                builders' Describe What You Need cards
  css/styles.css              Adds styling for the new action row + interpretation box
  schema/schema-sample.js     Embedded sample schema — unchanged
  js/
    schema-engine.js          Read-only schema accessors — unchanged
    datatype-engine.js          Data-type classification + dialect-aware conversion — unchanged
    filter-engine.js              Multi-column WHERE filter engine — unchanged
    decode-engine.js                Decode CASE generation — unchanged
    validation-engine.js              Schema-aware request validation — unchanged
    sql-engine.js                       Read-only SELECT/WITH generator — unchanged
    cr-engine.js                          INSERT/UPDATE/DELETE generator — unchanged
    schema-tools.js                        Import/export/validate/diff/merge — unchanged
    relationship-store.js                    Session-only manual relationships — unchanged
    suggestion-engine.js                       Corrective suggestions — wording updated
    optimize-engine.js                           SQL Optimization Advisor — unchanged
    error-rectifier-engine.js                      Error Rectifier's correction engine — unchanged
    nl-query-engine.js                              NEW — description-to-selection interpreter
    app.js                                            DOM wiring — new Build Query buttons +
                                                       description-to-UI-state merge logic
  test/                       Node test suite
    run-all.js                  Pure-logic test runner (npm test)
    dom-smoke.js                 End-to-end DOM/Bootstrap simulation smoke test (npm run test:smoke)
    nl-query-engine.test.js       NEW — 32 tests covering every matching/merge rule
```

## Running the test suites
```bash
npm test            # 141 pure-logic unit tests across all engine modules
npm run test:smoke  # 28 end-to-end simulation checks
```
The unit suite includes an exact reproduction of the application's own
placeholder example sentence, confirmed to correctly identify the right
table, columns, and a computed "last 30 days" date filter. The smoke test
proves — by actually clicking the real, new button in a simulated DOM,
not just reading the code — that a query can be built from description
text alone with zero manual selections, that both Build Query buttons
behave identically, that a manual selection and a description merge
sensibly rather than one overriding the other, and that the WHERE-safety
net can never be silently bypassed by a description.

## Known limitations
- Legacy binary `.xls` export/import (OLE2/BIFF8) is not included. JSON,
  CSV, DOCX, XLSX and DOC (RTF) are all fully supported.
- **Requires internet access** to load Bootstrap 5.3, Bootstrap Icons, and
  Google Fonts from their CDNs.
- The description interpreter is a lightweight, schema-driven pattern
  matcher, not a full natural-language understanding system. It works
  best with clear phrasing that names tables/columns close to their real
  schema names or aliases, and filter/sort/limit phrases similar to the
  examples above. It never invents a table, column, or value it can't
  confidently identify from the schema.
- The description interpreter does not use hard-coded business-domain
  synonyms (e.g. "vendor" for "supplier") — matching is based solely on
  what the active schema documents, consistent with this application's
  schema-as-source-of-truth principle throughout.
- Schema persistence uses the browser's `localStorage`, which is scoped
  per browser/device. It is not a cross-device sync mechanism.
