'use strict';
var path = require('path');
var schema = require(path.join(__dirname, '..', 'schema', 'schema-sample.js'));
var SCHEMA_ENGINE = require(path.join(__dirname, '..', 'js', 'schema-engine.js'));
global.APSQL_DATATYPE = require(path.join(__dirname, '..', 'js', 'datatype-engine.js'));
var NLQ = require(path.join(__dirname, '..', 'js', 'nl-query-engine.js'));
var engine = SCHEMA_ENGINE.createEngine(schema);
var FIXED_NOW = new Date('2026-09-08T00:00:00Z');

test('matches a table by its bare (module-stripped) name', function () {
  var r = NLQ.interpretDescription('show all invoices', engine, {});
  assertTrue(r.tables.indexOf('IA_INVOICE') !== -1);
});
test('matches columns by name and by alias', function () {
  var r = NLQ.interpretDescription('show invoice number and gross amount for invoices', engine, {});
  var cols = r.columns.map(function (c) { return c.column; });
  assertTrue(cols.indexOf('INVOICE_NUMBER') !== -1);
  assertTrue(cols.indexOf('GROSS_SUM') !== -1, 'GROSS_SUM should be matched via its alias "Amount"');
});
test('exact reproduction of the app\u2019s own placeholder example sentence', function () {
  var r = NLQ.interpretDescription('overdue invoices for a supplier in the last 30 days, show invoice number, gross amount and due date', engine, { now: FIXED_NOW });
  assertTrue(r.tables.indexOf('IA_INVOICE') !== -1);
  var cols = r.columns.map(function (c) { return c.column; });
  assertTrue(cols.indexOf('INVOICE_NUMBER') !== -1);
  assertTrue(cols.indexOf('GROSS_SUM') !== -1);
  assertTrue(cols.indexOf('DUE_DATE') !== -1);
  assertEqual(r.filterConditions.length, 1);
  assertEqual(r.filterConditions[0].column, 'DUE_DATE');
  assertEqual(r.filterConditions[0].operator, 'gte');
  assertEqual(r.filterConditions[0].value, '2026-08-09');
});
test('returns a warning and no tables when nothing schema-related is mentioned', function () {
  var r = NLQ.interpretDescription('show me something interesting please', engine, {});
  assertEqual(r.tables.length, 0);
  assertTrue(r.warnings.length > 0);
});
test('empty description text returns a fully empty interpretation with no warnings', function () {
  var r = NLQ.interpretDescription('', engine, {});
  assertEqual(r.tables.length, 0);
  assertEqual(r.warnings.length, 0);
});
test('a "dangling" table with no matched columns/filters/sort is dropped unless it is the single top-scoring table', function () {
  var r = NLQ.interpretDescription('overdue invoices for a supplier', engine, {});
  assertTrue(r.tables.indexOf('IA_SUPPLIER') === -1);
  assertTrue(r.tables.indexOf('IA_INVOICE') !== -1);
});

test('greater than / less than operators', function () {
  var r = NLQ.interpretDescription('invoices with gross amount greater than 500', engine, {});
  var f = r.filterConditions.filter(function (c) { return c.column === 'GROSS_SUM'; })[0];
  assertTrue(f !== undefined);
  assertEqual(f.operator, 'gt');
  assertEqual(f.value, '500');
});
test('between operator captures both values', function () {
  var r = NLQ.interpretDescription('invoices with gross amount between 100 and 500', engine, {});
  var f = r.filterConditions.filter(function (c) { return c.column === 'GROSS_SUM'; })[0];
  assertEqual(f.operator, 'between');
  assertEqual(f.value, '100');
  assertEqual(f.value2, '500');
});
test('equals operator preserves original value casing (not lowercased)', function () {
  var r = NLQ.interpretDescription('invoices with invoice number is INV-9001', engine, {});
  var f = r.filterConditions.filter(function (c) { return c.column === 'INVOICE_NUMBER'; })[0];
  assertEqual(f.operator, 'eq');
  assertEqual(f.value, 'INV-9001', 'captured value must preserve original casing, not be lowercased');
});
test('decode label matching resolves a plain-language status word to its schema code', function () {
  var r = NLQ.interpretDescription('show approved invoices', engine, {});
  var f = r.filterConditions.filter(function (c) { return c.column === 'STATUS'; })[0];
  assertTrue(f !== undefined);
  assertEqual(f.operator, 'eq');
  assertEqual(f.value, '40');
});
test('decode-label matching does not override an already-matched explicit operator filter on the same column', function () {
  var r = NLQ.interpretDescription('show invoices where status is 10 and not approved', engine, {});
  var statusFilters = r.filterConditions.filter(function (c) { return c.column === 'STATUS'; });
  assertEqual(statusFilters.length, 1, 'only one STATUS filter should be produced, the first one matched');
  assertEqual(statusFilters[0].value, '10');
});

test('V10.5: "is one of" phrasing produces an "in" operator with the raw comma-separated value list', function () {
  var r = NLQ.interpretDescription('show invoices where status is one of 10, 40', engine, {});
  var f = r.filterConditions.filter(function (c) { return c.column === 'STATUS'; })[0];
  assertTrue(f !== undefined);
  assertEqual(f.operator, 'in');
  assertEqual(f.value, '10, 40');
});
test('V10.5: "is not one of" phrasing produces a "not_in" operator', function () {
  var r = NLQ.interpretDescription('show invoices where status is not one of 10, 40', engine, {});
  var f = r.filterConditions.filter(function (c) { return c.column === 'STATUS'; })[0];
  assertEqual(f.operator, 'not_in');
  assertEqual(f.value, '10, 40');
});
test('V10.5: "is any of" is accepted as a synonym for "is one of"', function () {
  var r = NLQ.interpretDescription('show invoices where status is any of 10, 90', engine, {});
  var f = r.filterConditions.filter(function (c) { return c.column === 'STATUS'; })[0];
  assertEqual(f.operator, 'in');
});
test('V10.5: adding "is one of" support does not break the plain "is" (eq) pattern for a single value', function () {
  var r = NLQ.interpretDescription('show invoices where status is 40', engine, {});
  var f = r.filterConditions.filter(function (c) { return c.column === 'STATUS'; })[0];
  assertEqual(f.operator, 'eq');
  assertEqual(f.value, '40');
});
test('V10.5: "is one of" does not shadow "between" phrasing for a different column in the same sentence', function () {
  var r = NLQ.interpretDescription('show invoices where status is one of 10, 40 and gross amount between 100 and 500', engine, {});
  var statusF = r.filterConditions.filter(function (c) { return c.column === 'STATUS'; })[0];
  var amountF = r.filterConditions.filter(function (c) { return c.column === 'GROSS_SUM'; })[0];
  assertEqual(statusF.operator, 'in');
  assertEqual(amountF.operator, 'between');
});

test('sort with explicit direction word', function () {
  var r = NLQ.interpretDescription('invoices sorted by due date descending', engine, {});
  assertEqual(r.orderBy.length, 1);
  assertEqual(r.orderBy[0].column, 'DUE_DATE');
  assertEqual(r.orderBy[0].direction, 'DESC');
});
test('sort defaults to ASC when no direction word is present', function () {
  var r = NLQ.interpretDescription('invoices sorted by due date', engine, {});
  assertEqual(r.orderBy[0].direction, 'ASC');
});
test('limit via "top N"', function () {
  var r = NLQ.interpretDescription('top 10 invoices', engine, {});
  assertEqual(r.limit, 10);
});
test('distinct via "unique"/"no duplicates"', function () {
  assertTrue(NLQ.interpretDescription('unique suppliers with invoices', engine, {}).distinct);
  assertTrue(NLQ.interpretDescription('invoices, no duplicates', engine, {}).distinct);
});

test('hierarchy intent uniquely resolved when the schema has only one self-referencing table', function () {
  var tinySchema = { schema_name: 'x', schema_version: '1.0', module_labels: { T: 'Test' }, tables: [
    { name: 'T_NODE', module: 'T', notes: '', columns: [
      { name: 'NODE_ID', type: 'INTEGER', primary_key: true, foreign_key: null, alias: '', description: '' },
      { name: 'PARENT_ID', type: 'INTEGER', primary_key: false, foreign_key: { table: 'T_NODE', column: 'NODE_ID' }, alias: '', description: '' }
    ] }
  ] };
  var tinyEngine = SCHEMA_ENGINE.createEngine(tinySchema);
  var r = NLQ.interpretDescription('show the hierarchy', tinyEngine, {});
  assertEqual(r.hierarchyTable, 'T_NODE');
});
test('hierarchy word-overlap disambiguation picks the table matching "users"', function () {
  var r = NLQ.interpretDescription('show the reporting chain for users', engine, {});
  assertEqual(r.hierarchyTable, 'ADM_USER_DATA');
});
test('hierarchy word-overlap disambiguation picks the table matching "suppliers"', function () {
  var r = NLQ.interpretDescription('show the reporting chain for suppliers', engine, {});
  assertEqual(r.hierarchyTable, 'IA_SUPPLIER');
});
test('hierarchy intent with no disambiguating word at all returns null rather than guessing', function () {
  var r = NLQ.interpretDescription('show me the org chart', engine, {});
  assertEqual(r.hierarchyTable, null);
});
test('no hierarchy keyword present -> hierarchyTable is always null', function () {
  var r = NLQ.interpretDescription('show all invoices', engine, {});
  assertEqual(r.hierarchyTable, null);
});

test('UPDATE with SET and WHERE clauses, correctly segmented', function () {
  var r = NLQ.interpretCrDescription('update the invoice status to 40 where invoice id is 123', engine, {});
  assertEqual(r.command, 'UPDATE');
  assertEqual(r.table, 'IA_INVOICE');
  assertEqual(r.updateColumns.length, 1);
  assertEqual(r.updateColumns[0].column, 'STATUS');
  assertEqual(r.updateColumns[0].value, '40');
  assertEqual(r.filterConditions.length, 1);
  assertEqual(r.filterConditions[0].column, 'INVOICE_ID');
  assertEqual(r.filterConditions[0].value, '123');
});
test('the WHERE-clause column is never also captured as an UPDATE assignment (segmentation prevents ambiguity)', function () {
  var r = NLQ.interpretCrDescription('update the invoice status to 40 where invoice id is 123', engine, {});
  var updatesInvoiceId = r.updateColumns.some(function (c) { return c.column === 'INVOICE_ID'; });
  assertFalse(updatesInvoiceId, 'INVOICE_ID must only appear as a WHERE filter, never as an update target');
});
test('INSERT with multiple "=" value assignments, preserving original casing', function () {
  var r = NLQ.interpretCrDescription('insert a new invoice with invoice number = INV-9001 and gross amount = 250.00', engine, {});
  assertEqual(r.command, 'INSERT');
  assertEqual(r.table, 'IA_INVOICE');
  var byName = {}; r.insertColumns.forEach(function (c) { byName[c.name] = c.value; });
  assertEqual(byName.INVOICE_NUMBER, 'INV-9001');
  assertEqual(byName.GROSS_SUM, '250.00');
});
test('DELETE with a WHERE clause', function () {
  var r = NLQ.interpretCrDescription('delete the invoice where invoice id is 123', engine, {});
  assertEqual(r.command, 'DELETE');
  assertEqual(r.table, 'IA_INVOICE');
  assertEqual(r.filterConditions.length, 1);
  assertEqual(r.filterConditions[0].column, 'INVOICE_ID');
});
test('V10.5: DELETE with an "is one of" WHERE clause', function () {
  var r = NLQ.interpretCrDescription('delete the invoice where status is one of 0, 90', engine, {});
  assertEqual(r.command, 'DELETE');
  assertEqual(r.filterConditions[0].operator, 'in');
  assertEqual(r.filterConditions[0].value, '0, 90');
});
test('command detection prefers whichever keyword appears earliest in the text', function () {
  assertEqual(NLQ.detectCrCommand('please delete this, do not update it'), 'DELETE');
  assertEqual(NLQ.detectCrCommand('please update this record'), 'UPDATE');
  assertEqual(NLQ.detectCrCommand('insert a brand new record'), 'INSERT');
});
test('no command keyword present -> command is null (caller keeps whatever is manually selected)', function () {
  var r = NLQ.interpretCrDescription('the invoice for company 100', engine, {});
  assertEqual(r.command, null);
});
test('empty CR description text returns a fully empty, non-throwing interpretation', function () {
  var r = NLQ.interpretCrDescription('', engine, {});
  assertEqual(r.command, null);
  assertEqual(r.table, null);
  assertEqual(r.insertColumns.length, 0);
});

test('mergeTableLists unions and de-duplicates, case-insensitively, manual-first', function () {
  assertEqual(NLQ.mergeTableLists(['IA_INVOICE'], ['IA_INVOICE', 'IA_SUPPLIER']), ['IA_INVOICE', 'IA_SUPPLIER']);
  assertEqual(NLQ.mergeTableLists([], ['IA_SUPPLIER']), ['IA_SUPPLIER']);
  assertEqual(NLQ.mergeTableLists(['IA_INVOICE'], []), ['IA_INVOICE']);
});
test('mergeColumnLists keeps all manual columns untouched', function () {
  var manual = [{ table: 'IA_INVOICE', column: 'STATUS' }];
  var nl = [{ table: 'IA_INVOICE', column: 'GROSS_SUM' }];
  var merged = NLQ.mergeColumnLists(manual, nl);
  assertEqual(merged.length, 1);
  assertEqual(merged[0].column, 'STATUS');
});
test('mergeColumnLists adds NL columns only for tables with zero manual columns', function () {
  var manual = [{ table: 'IA_INVOICE', column: 'STATUS' }];
  var nl = [{ table: 'IA_SUPPLIER', column: 'SUPPLIER_NAME' }];
  var merged = NLQ.mergeColumnLists(manual, nl);
  assertEqual(merged.length, 2);
  assertTrue(merged.some(function (c) { return c.table === 'IA_SUPPLIER' && c.column === 'SUPPLIER_NAME'; }));
});
test('mergeColumnLists never adds an exact duplicate table+column pair', function () {
  var nl = [{ table: 'IA_INVOICE', column: 'STATUS' }];
  var merged = NLQ.mergeColumnLists([], nl);
  assertEqual(merged.length, 1);
});
test('mergeFilterConditions appends non-duplicate NL filters and skips exact duplicates', function () {
  var manual = [{ table: 'IA_INVOICE', column: 'STATUS', operator: 'eq', value: '40' }];
  var nl = [
    { table: 'IA_INVOICE', column: 'STATUS', operator: 'eq', value: '40' },
    { table: 'IA_INVOICE', column: 'COMPANY_ID', operator: 'eq', value: '100' }
  ];
  var merged = NLQ.mergeFilterConditions(manual, nl);
  assertEqual(merged.length, 2);
  assertTrue(merged.some(function (c) { return c.column === 'COMPANY_ID'; }));
});
test('merge helpers handle empty/undefined inputs gracefully', function () {
  assertEqual(NLQ.mergeTableLists(undefined, undefined), []);
  assertEqual(NLQ.mergeColumnLists(undefined, undefined), []);
  assertEqual(NLQ.mergeFilterConditions(undefined, undefined), []);
});
