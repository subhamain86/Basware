'use strict';
var path = require('path');
var schema = require(path.join(__dirname, '..', 'schema', 'schema-sample.js'));
var SCHEMA_ENGINE = require(path.join(__dirname, '..', 'js', 'schema-engine.js'));
var DECODE = require(path.join(__dirname, '..', 'js', 'decode-engine.js'));
var SQL_ENGINE = require(path.join(__dirname, '..', 'js', 'sql-engine.js'));
var FILTER = require(path.join(__dirname, '..', 'js', 'filter-engine.js'));
var engine = SCHEMA_ENGINE.createEngine(schema);
var store = DECODE.createDecodeStore();
test('no tables -> clarification', function () { assertEqual(SQL_ENGINE.generateSql('', { selectedTables: [] }, engine, store).status, 'clarification_needed'); });
test('basic SELECT', function () { var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER', alias: 'X' }] }, engine, store); assertEqual(r.status, 'ok'); assertIncludes(r.sql, 'SELECT IA_INVOICE.INVOICE_NUMBER AS X'); });
test('rejects unknown column', function () { assertEqual(SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'NOPE' }] }, engine, store).status, 'rejected'); });
test('auto-joins related tables', function () { var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE', 'IA_SUPPLIER'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }, { table: 'IA_SUPPLIER', column: 'SUPPLIER_NAME' }] }, engine, store); assertIncludes(r.sql, 'INNER JOIN IA_SUPPLIER ON IA_INVOICE.SUPPLIER_ID = IA_SUPPLIER.SUPPLIER_ID'); });
test('rejects unrelated join', function () { assertEqual(SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE', 'ADM_USER_GROUP'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }] }, engine, store).status, 'rejected'); });
test('multi-column WHERE filter', function () { var fg = { conditions: [FILTER.newCondition({ table: 'IA_INVOICE', column: 'COMPANY_ID', operator: 'eq', value: '100' }), FILTER.newCondition({ table: 'IA_INVOICE', column: 'STATUS', operator: 'eq', value: '40', join: 'AND' })] }; var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filterGroup: fg }, engine, store); assertIncludes(r.sql, 'WHERE IA_INVOICE.COMPANY_ID = 100 AND IA_INVOICE.STATUS = 40'); });
test('DISTINCT/limit/orderBy per dialect', function () { var r1 = SQL_ENGINE.generateSql('', { dialect: 'SQL Server', selectedTables: ['IA_INVOICE'], distinct: true, limit: 10, orderBy: 'IA_INVOICE.GROSS_SUM DESC', selectedColumns: [{ table: 'IA_INVOICE', column: 'GROSS_SUM' }] }, engine, store); assertIncludes(r1.sql, 'SELECT TOP 10 DISTINCT'); var r2 = SQL_ENGINE.generateSql('', { dialect: 'Oracle', selectedTables: ['IA_INVOICE'], limit: 5, selectedColumns: [{ table: 'IA_INVOICE', column: 'GROSS_SUM' }] }, engine, store); assertIncludes(r2.sql, 'FETCH FIRST 5 ROWS ONLY'); });
test('named view wrap', function () { assertIncludes(SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], viewName: 'MyView', selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }] }, engine, store).sql, 'WITH MyView AS ('); });
test('decode CASE applied', function () { var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'STATUS', alias: 'S', decode: true }] }, engine, store); assertIncludes(r.sql, "WHEN IA_INVOICE.STATUS = 0 THEN 'Draft'"); });
test('recursive hierarchy', function () { assertIncludes(SQL_ENGINE.generateSql('', { selectedTables: ['ADM_USER_DATA'], recursiveHierarchy: { table: 'ADM_USER_DATA' } }, engine, store).sql, 'WITH RECURSIVE hierarchy AS'); });
test('EXISTS filter', function () { var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_SUPPLIER'], existsFilter: { relatedTable: 'IA_INVOICE' }, selectedColumns: [{ table: 'IA_SUPPLIER', column: 'SUPPLIER_NAME' }] }, engine, store); assertIncludes(r.sql, 'EXISTS (SELECT 1 FROM IA_INVOICE'); });
test('scalar count subquery', function () { var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_SUPPLIER'], scalarSubquery: { relatedTable: 'IA_INVOICE', aggFunc: 'COUNT', alias: 'C' }, selectedColumns: [{ table: 'IA_SUPPLIER', column: 'SUPPLIER_NAME' }] }, engine, store); assertIncludes(r.sql, '(SELECT COUNT(*) FROM IA_INVOICE WHERE IA_INVOICE.SUPPLIER_ID = IA_SUPPLIER.SUPPLIER_ID) AS C'); });
test('GROUP BY / HAVING', function () { var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'STATUS' }], groupBy: ['IA_INVOICE.STATUS'], having: 'COUNT(*) > 5' }, engine, store); assertIncludes(r.sql, 'GROUP BY IA_INVOICE.STATUS'); assertIncludes(r.sql, 'HAVING COUNT(*) > 5'); });
test('buildJoinPlan: order-independent 3-table chain', function () {
  var plan = SQL_ENGINE.buildJoinPlan(engine, ['IA_INVOICE', 'OM_ORDER', 'IA_SUPPLIER']);
  assertEqual(plan.errors.length, 0);
  assertEqual(plan.joins.length, 2);
});
test('generateSql surfaces `unresolvedTables` on the rejected result', function () {
  var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE', 'ADM_USER_GROUP'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }] }, engine, store);
  assertEqual(r.status, 'rejected');
  assertEqual(r.unresolvedTables, ['ADM_USER_GROUP']);
});
test('V10: numeric LOGIN_TYPE column with decode + Oracle dialect produces TO_CHAR ELSE end-to-end', function () {
  var r = SQL_ENGINE.generateSql('', { dialect: 'Oracle', selectedTables: ['ADM_USER_DATA'], selectedColumns: [{ table: 'ADM_USER_DATA', column: 'LOGIN_TYPE', alias: 'LOGIN_TYPE', decode: true }] }, engine, store);
  assertEqual(r.status, 'ok');
  assertIncludes(r.sql, 'ELSE TO_CHAR(ADM_USER_DATA.LOGIN_TYPE)');
});
test('V10: elseMode "keep" overrides the safe default even through generateSql', function () {
  var r = SQL_ENGINE.generateSql('', { dialect: 'Oracle', selectedTables: ['ADM_USER_DATA'], selectedColumns: [{ table: 'ADM_USER_DATA', column: 'LOGIN_TYPE', alias: 'LOGIN_TYPE', decode: true, elseMode: 'keep' }] }, engine, store);
  assertIncludes(r.sql, 'ELSE ADM_USER_DATA.LOGIN_TYPE');
  assertFalse(/TO_CHAR/.test(r.sql));
});
test('V10.5: an "is one of" filter end-to-end through generateSql produces a real IN (...) clause in the final SQL', function () {
  var fg = { conditions: [FILTER.newCondition({ table: 'IA_INVOICE', column: 'STATUS', operator: 'in', value: '10, 40, 90' })] };
  var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filterGroup: fg }, engine, store);
  assertEqual(r.status, 'ok');
  assertIncludes(r.sql, 'WHERE IA_INVOICE.STATUS IN (10, 40, 90)');
});
test('V10.5: an "is not one of" filter combined with another AND condition end-to-end', function () {
  var fg = { conditions: [
    FILTER.newCondition({ table: 'IA_INVOICE', column: 'COMPANY_ID', operator: 'eq', value: '100' }),
    FILTER.newCondition({ table: 'IA_INVOICE', column: 'STATUS', operator: 'not_in', value: '0, 90', join: 'AND' })
  ] };
  var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filterGroup: fg }, engine, store);
  assertEqual(r.status, 'ok');
  assertIncludes(r.sql, 'WHERE IA_INVOICE.COMPANY_ID = 100 AND IA_INVOICE.STATUS NOT IN (0, 90)');
});
test('V10.5: an "is one of" filter with no values is rejected end-to-end with a clear message', function () {
  var fg = { conditions: [FILTER.newCondition({ table: 'IA_INVOICE', column: 'STATUS', operator: 'in', value: '' })] };
  var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filterGroup: fg }, engine, store);
  assertEqual(r.status, 'rejected');
  assertIncludes(r.message, 'needs at least one value');
});

/* ---- V10.6: aggregate columns (COUNT/SUM/AVG/MIN/MAX) ---- */
test('V10.6: COUNT(*) aggregate column with an alias', function () {
  var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: '*', aggregate: 'COUNT', alias: 'record_count' }] }, engine, store);
  assertEqual(r.status, 'ok');
  assertIncludes(r.sql, 'SELECT COUNT(*) AS record_count');
});
test('V10.6: SUM aggregate column on a real column, combined with GROUP BY', function () {
  var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'SUPPLIER_ID' }, { table: 'IA_INVOICE', column: 'GROSS_SUM', aggregate: 'SUM', alias: 'total_amount' }], groupBy: ['IA_INVOICE.SUPPLIER_ID'] }, engine, store);
  assertEqual(r.status, 'ok');
  assertIncludes(r.sql, 'SUM(IA_INVOICE.GROSS_SUM) AS total_amount');
  assertIncludes(r.sql, 'GROUP BY IA_INVOICE.SUPPLIER_ID');
});
test('V10.6: AVG/MIN/MAX all produce correctly-shaped expressions', function () {
  ['AVG', 'MIN', 'MAX'].forEach(function (fn) {
    var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'GROSS_SUM', aggregate: fn }] }, engine, store);
    assertEqual(r.status, 'ok');
    assertIncludes(r.sql, fn + '(IA_INVOICE.GROSS_SUM)');
  });
});
test('V10.6: a DISTINCT aggregate column produces COUNT(DISTINCT ...)', function () {
  var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'SUPPLIER_ID', aggregate: 'COUNT', distinct: true, alias: 'distinct_suppliers' }] }, engine, store);
  assertEqual(r.status, 'ok');
  assertIncludes(r.sql, 'COUNT(DISTINCT IA_INVOICE.SUPPLIER_ID) AS distinct_suppliers');
});
test('V10.6: an aggregate column referencing a non-existent column is still rejected (schema validation applies)', function () {
  var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'NOPE_COL', aggregate: 'SUM' }] }, engine, store);
  assertEqual(r.status, 'rejected');
});
