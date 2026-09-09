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
test('rejects unrelated join', function () { assertEqual(SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE', 'ADM_USER_DATA'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }] }, engine, store).status, 'rejected'); });
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
  var r = SQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE', 'ADM_USER_DATA'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }] }, engine, store);
  assertEqual(r.status, 'rejected');
  assertEqual(r.unresolvedTables, ['ADM_USER_DATA']);
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
