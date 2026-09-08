# AP-SQL Assistant — Version 10.0

A schema-aware SQL generator. Version 10.0 introduces two major
enhancements: data-type-aware Decode (so Decode's generated `CASE`
expressions never trigger a datatype-mismatch database error), and a
brand-new **Error Rectifier** page that analyzes a real database error
together with the SQL that caused it, and proposes a corrected query.

Open `index.html` directly in any modern browser. **Requires internet
access** to load Bootstrap 5.3, Bootstrap Icons, and Google Fonts from
their CDNs. No build step, server, or local package installation is
required.

Crafted by Subham Ain.

## What changed in Version 10.0

### 1. Data-type-aware Decode
Previously, Decode always generated:
```sql
CASE
    WHEN LOGIN_TYPE = 0 THEN 'Forms'
    WHEN LOGIN_TYPE = 1 THEN 'Windows Domain'
    ELSE LOGIN_TYPE
END
```
If `LOGIN_TYPE` is a numeric column, Oracle (and many other databases)
reject this outright, since the `THEN` branches return text but the
`ELSE` branch returns a number:
```
ORA-00932: inconsistent datatypes: expected CHAR got NUMBER
```

Decode now inspects the selected column's **Data Type** from the active
schema before generating SQL, and — only when that column is genuinely
non-text (`NUMBER`, `INTEGER`, `DECIMAL`, `FLOAT`, `DATE`, `TIMESTAMP`,
`BOOLEAN`, and their common synonyms) — rewrites the `ELSE` branch to a
**dialect-appropriate** "convert to text" expression:

| Dialect | Example |
|---|---|
| Oracle | `ELSE TO_CHAR(LOGIN_TYPE)` |
| SQL Server | `ELSE CONVERT(VARCHAR(4000), LOGIN_TYPE)` |
| PostgreSQL | `ELSE LOGIN_TYPE::text` |
| MySQL | `ELSE CAST(LOGIN_TYPE AS CHAR)` |
| Generic | `ELSE CAST(LOGIN_TYPE AS VARCHAR(4000))` |

This is never hard-coded to Oracle — the exact conversion syntax is
chosen from the currently selected SQL dialect. When a column is already
text-typed, or the schema simply doesn't document a data type for it, the
`ELSE` branch is left completely unchanged — Decode never invents a data
type it doesn't actually know.

**UI**: when Decode is ticked on a column, a small panel now shows the
detected **Data Type** and a choice — **Convert to compatible text**
(the safe default) or **Keep original value** (an explicit opt-out that
reproduces the exact pre-V10 SQL). If no data type is available in the
schema, a short note explains that the original value will be used, and
no choice is needed.

### 2. Error Rectifier (new page)
A brand-new, independent page — added as its own entry in the existing
hamburger menu (Schema → Query Builder → **Error Rectifier** → Theme →
About), with no other changes to the menu's structure or design.

Three boxes, exactly as needed for the workflow:

1. **Enter Database Error** — paste the complete error message (Oracle,
   SQL Server, PostgreSQL, MySQL, or another supported dialect).
2. **Enter Current SQL Query** — paste the SQL that produced it.
3. **Rectified SQL** — the corrected query, generated after clicking
   **Rectify SQL**, together with a plain-language **Explanation**
   ("Error Identified" / "Correction Applied") and, where applicable, a
   **What Changed** before/after list. **Copy SQL** and **Copy
   Explanation** buttons are provided.

The SQL dialect is auto-detected from the pasted error where possible
(recognizing `ORA-`, SQL Server's `Msg #, Level #`, PostgreSQL's `ERROR:`
style, and MySQL's characteristic phrasing) and the dropdown updates
automatically — you can always change it manually too.

**How correction works**: a new rule-based engine (`error-rectifier-engine.js`)
cross-references every table and column it finds in the SQL against the
**active schema** (the same one used everywhere else in this
application), and only proposes a change when it has found something
concrete and defensible — it never invents a table or column that
doesn't exist. It recognizes, among others: inconsistent CASE/ELSE and
WHERE-clause data types (reusing the same Decode engine described above),
unknown/misspelled columns and tables (suggesting the closest real match
in the schema), missing `GROUP BY` columns, date-literal format
mismatches, `= NULL` / `<> NULL` anti-patterns, stray trailing commas,
dialect-incorrect NULL-handling functions (`NVL`/`ISNULL`/`IFNULL`/`COALESCE`),
and join conditions that reference the wrong columns (correcting them
using the schema's documented relationship). If nothing applicable is
found, it says so plainly rather than guessing.

**Safety**: exactly like the rest of this application, the Error
Rectifier only ever analyzes text and produces corrected SQL text. It
never executes SQL, never connects to a database, and never modifies the
active schema — this is stated explicitly on the page itself.

## Project structure
```
ap-sql-assistant/
  index.html                 Application shell, including the new Error Rectifier page
  css/styles.css              Adds Decode data-type panel + Error Rectifier page styling
  schema/schema-sample.js     Embedded sample schema — now includes a LOGIN_TYPE (NUMBER)
                                column with decode values on ADM_USER_DATA, matching the
                                worked example from the V10 specification
  js/
    schema-engine.js          Read-only schema accessors — unchanged
    datatype-engine.js          NEW — data-type classification + dialect-aware text conversion
    filter-engine.js              Multi-column WHERE filter engine — unchanged
    decode-engine.js               Decode CASE generation — ELSE branch now data-type/dialect-aware
    validation-engine.js            Schema-aware request validation — unchanged
    sql-engine.js                    Read-only SELECT/WITH generator — passes dialect + column
                                       type through to decode-engine.js; joins unchanged (V9.2)
    cr-engine.js                      INSERT/UPDATE/DELETE generator — unchanged
    schema-tools.js                    Import/export/validate/diff/merge/relationships — unchanged
    relationship-store.js               Session-only manual relationships — unchanged
    suggestion-engine.js                 Corrective suggestions — unchanged
    optimize-engine.js                    SQL Optimization Advisor — unchanged
    error-rectifier-engine.js               NEW — the Error Rectifier's rule-based correction engine
    app.js                                    DOM wiring — Decode data-type UI + Error Rectifier page
  test/                       Node test suite
    run-all.js                  Pure-logic test runner (npm test)
    dom-smoke.js                 End-to-end DOM/Bootstrap simulation smoke test (npm run test:smoke)
    datatype-engine.test.js       NEW
    error-rectifier-engine.test.js NEW
```

## Running the test suites
```bash
npm test            # 153 pure-logic unit tests across all engine modules
npm run test:smoke  # 24 end-to-end simulation checks
```
The unit suite includes a dedicated reproduction of the exact
`LOGIN_TYPE` / `ORA-00932` scenario from the specification, confirmed to
produce the exact corrected SQL shown in the spec, across all five
supported dialects. The smoke test drives the real `app.js` through a
full, real click-to-result Error Rectifier round trip — including dialect
auto-detection actually updating the dropdown — rather than only reading
the code.

## Known limitations
- Legacy binary `.xls` export/import (OLE2/BIFF8) is not included. JSON,
  CSV, DOCX, XLSX and DOC (RTF) are all fully supported.
- **Requires internet access** to load Bootstrap 5.3, Bootstrap Icons, and
  Google Fonts from their CDNs.
- The Error Rectifier is a lightweight, regex/heuristic-based SQL
  "sniffer," not a full SQL parser — a deliberate, honest trade-off for a
  dependency-free, client-side tool. It is scoped to recognize a broad,
  realistic set of common error categories, and always says so plainly
  when it cannot confidently determine a fix, rather than guessing.
- Schema persistence uses the browser's `localStorage`, which is scoped
  per browser/device. It is not a cross-device sync mechanism.
- The Decode "convert to text" rewrite only ever changes the `ELSE`
  branch of a decode expression; it never alters the `WHEN`/`THEN`
  values, column/table selections, or any other part of the query.
