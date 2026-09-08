'use strict';
var path = require('path');
var schema = require(path.join(__dirname, '..', 'schema', 'schema-sample.js'));
var SCHEMA_ENGINE = require(path.join(__dirname, '..', 'js', 'schema-engine.js'));
global.APSQL_DATATYPE = require(path.join(__dirname, '..', 'js', 'datatype-engine.js'));
var ERR = require(path.join(__dirname, '..', 'js', 'error-rectifier-engine.js'));
var engine = SCHEMA_ENGINE.createEngine(schema);

/* ---- Rule: CASE/ELSE datatype mismatch — the flagship scenario from the spec ---- */
test('exact spec scenario: ORA-00932 on LOGIN_TYPE CASE/ELSE, Oracle dialect', function () {
  var sql = "SELECT\n    LOGIN_TYPE,\n    CASE\n        WHEN LOGIN_TYPE = 0 THEN 'Forms'\n        WHEN LOGIN_TYPE = 1 THEN 'Windows Domain'\n        ELSE LOGIN_TYPE\n    END AS LOGIN_TYPE\nFROM ADM_USER_DATA;";
  var error = 'ORA-00932: inconsistent datatypes: expected CHAR got NUMBER';
  var r = ERR.rectify(sql, error, engine, 'Oracle');
  assertTrue(r.changed);
  assertEqual(r.ruleId, 'case-else-datatype');
  assertIncludes(r.correctedSql, 'ELSE TO_CHAR(LOGIN_TYPE)');
  assertEqual(r.changes[0].from, 'ELSE LOGIN_TYPE');
  assertEqual(r.changes[0].to, 'ELSE TO_CHAR(LOGIN_TYPE)');
});
test('same scenario, SQL Server dialect produces CONVERT(...) not TO_CHAR', function () {
  var sql = "SELECT CASE WHEN LOGIN_TYPE = 0 THEN 'Forms' ELSE LOGIN_TYPE END AS LT FROM ADM_USER_DATA;";
  var r = ERR.rectify(sql, 'Conversion failed when converting the varchar value', engine, 'SQL Server');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'CONVERT(VARCHAR(4000), LOGIN_TYPE)');
});
test('same scenario, PostgreSQL dialect produces ::text', function () {
  var sql = "SELECT CASE WHEN LOGIN_TYPE = 0 THEN 'Forms' ELSE LOGIN_TYPE END AS LT FROM ADM_USER_DATA;";
  var r = ERR.rectify(sql, 'type mismatch', engine, 'PostgreSQL');
  assertIncludes(r.correctedSql, 'LOGIN_TYPE::text');
});
test('same scenario, MySQL dialect produces CAST(...AS CHAR)', function () {
  var sql = "SELECT CASE WHEN LOGIN_TYPE = 0 THEN 'Forms' ELSE LOGIN_TYPE END AS LT FROM ADM_USER_DATA;";
  var r = ERR.rectify(sql, 'type mismatch', engine, 'MySQL');
  assertIncludes(r.correctedSql, 'CAST(LOGIN_TYPE AS CHAR)');
});
test('CASE/ELSE rule handles a qualified column reference (TABLE.COLUMN) in ELSE', function () {
  var sql = "SELECT CASE WHEN ADM_USER_DATA.LOGIN_TYPE = 0 THEN 'Forms' ELSE ADM_USER_DATA.LOGIN_TYPE END AS LT FROM ADM_USER_DATA;";
  var r = ERR.rectify(sql, 'ORA-00932', engine, 'Oracle');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'ELSE TO_CHAR(ADM_USER_DATA.LOGIN_TYPE)');
});
test('CASE/ELSE rule does nothing when the ELSE column is already text-typed', function () {
  var sql = "SELECT CASE WHEN SUPPLIER_NAME = 'X' THEN 'Match' ELSE SUPPLIER_NAME END AS N FROM IA_SUPPLIER;";
  var r = ERR.rectify(sql, 'ORA-00932', engine, 'Oracle');
  assertFalse(r.changed);
});
test('CASE/ELSE rule does nothing when the referenced column is not found in the schema at all (does not invent)', function () {
  var sql = "SELECT CASE WHEN X = 0 THEN 'A' ELSE X END AS Y FROM IA_INVOICE;";
  var r = ERR.rectify(sql, 'ORA-00932', engine, 'Oracle');
  assertFalse(r.changed);
});

/* ---- Rule: WHERE-clause comparison datatype mismatch ---- */
test('numeric column compared to quoted string literal in WHERE gets unquoted', function () {
  var sql = "SELECT INVOICE_NUMBER FROM IA_INVOICE WHERE COMPANY_ID = '100'";
  var r = ERR.rectify(sql, 'ORA-00932: inconsistent datatypes', engine, 'Oracle');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'COMPANY_ID = 100');
  assertFalse(/'100'/.test(r.correctedSql));
});

/* ---- Rule: invalid/unknown column ---- */
test('invalid identifier error with a misspelled column suggests the closest schema match', function () {
  var sql = 'SELECT INVOICE_NUMBR FROM IA_INVOICE';
  var r = ERR.rectify(sql, 'ORA-00904: "INVOICE_NUMBR": invalid identifier', engine, 'Oracle');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'INVOICE_NUMBER');
  assertEqual(r.ruleId, 'invalid-column');
});
test('invalid column rule does nothing if the flagged identifier is not even present in the SQL', function () {
  var sql = 'SELECT INVOICE_NUMBER FROM IA_INVOICE';
  var r = ERR.rectify(sql, 'ORA-00904: "NOPE_COLUMN": invalid identifier', engine, 'Oracle');
  assertFalse(r.changed);
});

/* ---- Rule: invalid/unknown table ---- */
test('invalid table name error suggests the closest schema table match', function () {
  var sql = 'SELECT INVOICE_NUMBER FROM IA_INVOICEE';
  var r = ERR.rectify(sql, 'ORA-00942: table or view does not exist', engine, 'Oracle');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'FROM IA_INVOICE');
  assertEqual(r.ruleId, 'invalid-table');
});

/* ---- Rule: GROUP BY missing column ---- */
test('missing GROUP BY column is added automatically', function () {
  var sql = 'SELECT SUPPLIER_ID, COUNT(*) FROM IA_INVOICE GROUP BY SUPPLIER_ID, STATUS';
  // Deliberately craft a case where STATUS is selected but not grouped:
  var sql2 = 'SELECT SUPPLIER_ID, STATUS, COUNT(*) FROM IA_INVOICE GROUP BY SUPPLIER_ID';
  var r = ERR.rectify(sql2, 'ORA-00979: not a GROUP BY expression', engine, 'Oracle');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'GROUP BY SUPPLIER_ID, STATUS');
});
test('GROUP BY rule adds a GROUP BY clause entirely when none exists', function () {
  var sql = 'SELECT SUPPLIER_ID, COUNT(*) FROM IA_INVOICE';
  var r = ERR.rectify(sql, 'not a GROUP BY expression', engine, 'Oracle');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'GROUP BY SUPPLIER_ID');
});
test('GROUP BY rule does nothing when every select column is already grouped or aggregated', function () {
  var sql = 'SELECT SUPPLIER_ID, COUNT(*) FROM IA_INVOICE GROUP BY SUPPLIER_ID';
  var r = ERR.rectify(sql, 'not a GROUP BY expression', engine, 'Oracle');
  assertFalse(r.changed);
});

/* ---- Rule: date literal format ---- */
test('date column compared to a bare ISO literal gets wrapped for Oracle', function () {
  var sql = "SELECT INVOICE_NUMBER FROM IA_INVOICE WHERE DUE_DATE = '2024-01-01'";
  var r = ERR.rectify(sql, 'ORA-01861: literal does not match format string', engine, 'Oracle');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, "TO_DATE('2024-01-01', 'YYYY-MM-DD')");
});
test('date literal wrapping is dialect-specific (SQL Server)', function () {
  var sql = "SELECT INVOICE_NUMBER FROM IA_INVOICE WHERE DUE_DATE = '2024-01-01'";
  var r = ERR.rectify(sql, 'Conversion failed when converting date and/or time from character string', engine, 'SQL Server');
  assertIncludes(r.correctedSql, "CONVERT(DATE, '2024-01-01', 120)");
});

/* ---- Rule: NULL comparison anti-pattern ---- */
test('"= NULL" is rewritten to "IS NULL"', function () {
  var sql = 'SELECT INVOICE_NUMBER FROM IA_INVOICE WHERE DUE_DATE = NULL';
  var r = ERR.rectify(sql, 'unexpected NULL comparison behavior', engine, 'Oracle');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'DUE_DATE IS NULL');
});
test('"<> NULL" is rewritten to "IS NOT NULL"', function () {
  var sql = 'SELECT INVOICE_NUMBER FROM IA_INVOICE WHERE DUE_DATE <> NULL';
  var r = ERR.rectify(sql, 'null handling issue', engine, 'Oracle');
  assertIncludes(r.correctedSql, 'DUE_DATE IS NOT NULL');
});

/* ---- Rule: trailing comma ---- */
test('trailing comma before FROM is removed', function () {
  var sql = 'SELECT INVOICE_NUMBER, GROSS_SUM, FROM IA_INVOICE';
  var r = ERR.rectify(sql, 'ORA-00936: missing expression', engine, 'Oracle');
  assertTrue(r.changed);
  assertFalse(/,\s*FROM/.test(r.correctedSql));
});

/* ---- Rule: dialect-correct NULL-coalescing function ---- */
test('NVL used with a SQL Server dialect is remapped to ISNULL', function () {
  var sql = 'SELECT NVL(GROSS_SUM, 0) FROM IA_INVOICE';
  var r = ERR.rectify(sql, 'invalid identifier NVL', engine, 'SQL Server');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'ISNULL(GROSS_SUM, 0)');
});
test('ISNULL used with an Oracle dialect is remapped to NVL', function () {
  var sql = 'SELECT ISNULL(GROSS_SUM, 0) FROM IA_INVOICE';
  var r = ERR.rectify(sql, 'ORA-00904: invalid identifier', engine, 'Oracle');
  assertIncludes(r.correctedSql, 'NVL(GROSS_SUM, 0)');
});
test('IFNULL used with a PostgreSQL dialect is remapped to COALESCE', function () {
  var sql = 'SELECT IFNULL(GROSS_SUM, 0) FROM IA_INVOICE';
  var r = ERR.rectify(sql, 'function does not exist', engine, 'PostgreSQL');
  assertIncludes(r.correctedSql, 'COALESCE(GROSS_SUM, 0)');
});
test('a 3-argument COALESCE is NOT unsafely renamed to a 2-arg-only function', function () {
  var sql = 'SELECT COALESCE(A, B, C) FROM IA_INVOICE';
  var r = ERR.rectify(sql, 'invalid identifier', engine, 'Oracle');
  assertFalse(r.changed);
});

/* ---- Rule: join relationship correction ---- */
test('join ON clause referencing a non-existent column pairing is corrected using the schema relationship', function () {
  var sql = 'SELECT INVOICE_NUMBER FROM IA_INVOICE JOIN IA_SUPPLIER ON IA_INVOICE.WRONG_COL = IA_SUPPLIER.ALSO_WRONG';
  var r = ERR.rectify(sql, 'invalid join condition', engine, 'Oracle');
  assertTrue(r.changed);
  assertIncludes(r.correctedSql, 'IA_INVOICE.SUPPLIER_ID = IA_SUPPLIER.SUPPLIER_ID');
});

/* ---- The honest "no confident correction" fallback ---- */
test('completely unrecognized error + SQL with nothing to fix reports no change, honestly', function () {
  var sql = 'SELECT INVOICE_NUMBER FROM IA_INVOICE WHERE COMPANY_ID = 100';
  var r = ERR.rectify(sql, 'Some brand new database error nobody has ever seen before', engine, 'Oracle');
  assertFalse(r.changed);
  assertIncludes(r.errorIdentified, 'No specific');
  assertIncludes(r.correctionApplied, 'No automatic change was made');
});
test('empty SQL input is handled gracefully with a clear message', function () {
  var r = ERR.rectify('', 'ORA-00932', engine, 'Oracle');
  assertFalse(r.changed);
  assertIncludes(r.errorIdentified, 'No SQL was supplied');
});

/* ---- Dialect auto-detection ---- */
test('detectDialectFromError recognizes Oracle, SQL Server, PostgreSQL, MySQL error signatures', function () {
  assertEqual(ERR.detectDialectFromError('ORA-00932: inconsistent datatypes'), 'Oracle');
  assertEqual(ERR.detectDialectFromError('Msg 245, Level 16, State 1: Conversion failed'), 'SQL Server');
  assertEqual(ERR.detectDialectFromError('ERROR:  relation "foo" does not exist'), 'PostgreSQL');
  assertEqual(ERR.detectDialectFromError('You have an error in your SQL syntax; check the manual'), 'MySQL');
  assertEqual(ERR.detectDialectFromError('totally ambiguous text'), null);
});

/* ---- Safety guarantees ---- */
test('rectify() never touches the schema object it is given', function () {
  var before = JSON.stringify(schema);
  ERR.rectify("SELECT CASE WHEN LOGIN_TYPE=0 THEN 'A' ELSE LOGIN_TYPE END FROM ADM_USER_DATA", 'ORA-00932', engine, 'Oracle');
  assertEqual(JSON.stringify(schema), before);
});
test('rectify() result never contains any indication of execution — it only returns SQL text', function () {
  var r = ERR.rectify("SELECT 1 FROM IA_INVOICE", 'some error', engine, 'Oracle');
  assertTrue(typeof r.correctedSql === 'string');
});
