'use strict';
var path = require('path');
var schema = require(path.join(__dirname, '..', 'schema', 'schema-sample.js'));
var SCHEMA_ENGINE = require(path.join(__dirname, '..', 'js', 'schema-engine.js'));
var OPT = require(path.join(__dirname, '..', 'js', 'optimize-engine.js'));
var engine = SCHEMA_ENGINE.createEngine(schema);
test('removes redundant DISTINCT when the base table primary key is selected', function () {
  var result = { sql: 'SELECT DISTINCT IA_INVOICE.INVOICE_ID, IA_INVOICE.INVOICE_NUMBER\nFROM IA_INVOICE', tablesUsed: ['IA_INVOICE'], columnsUsed: [{ table: 'IA_INVOICE', column: 'INVOICE_ID' }, { table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filtersApplied: [], assumptions: [] };
  var opt = OPT.optimizeSql(engine, result);
  assertTrue(opt.hasChanges); assertFalse(/DISTINCT/.test(opt.optimizedSql));
});
test('keeps DISTINCT when the base table primary key is NOT selected', function () {
  var result = { sql: 'SELECT DISTINCT IA_INVOICE.STATUS\nFROM IA_INVOICE', tablesUsed: ['IA_INVOICE'], columnsUsed: [{ table: 'IA_INVOICE', column: 'STATUS' }], filtersApplied: [], assumptions: [] };
  assertFalse(OPT.optimizeSql(engine, result).hasChanges);
});
test('recommends adding a WHERE clause on a broad, unfiltered SELECT', function () {
  var result = { sql: 'SELECT IA_INVOICE.INVOICE_NUMBER\nFROM IA_INVOICE', tablesUsed: ['IA_INVOICE'], columnsUsed: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filtersApplied: [], assumptions: [] };
  assertTrue(OPT.optimizeSql(engine, result).recommendations.some(function (r) { return /no WHERE condition/.test(r); }));
});
test('flags a leading-wildcard LIKE', function () {
  var result = { sql: "SELECT IA_SUPPLIER.SUPPLIER_NAME\nFROM IA_SUPPLIER\nWHERE IA_SUPPLIER.SUPPLIER_NAME LIKE '%acme%'", tablesUsed: ['IA_SUPPLIER'], columnsUsed: [{ table: 'IA_SUPPLIER', column: 'SUPPLIER_NAME' }], filtersApplied: ["Filter: IA_SUPPLIER.SUPPLIER_NAME LIKE '%acme%'"], assumptions: [] };
  assertTrue(OPT.optimizeSql(engine, result).recommendations.some(function (r) { return /leading wildcard/.test(r); }));
});
test('Change Request results are never rewritten automatically', function () {
  var result = { command: 'INSERT', sql: "INSERT INTO IA_INVOICE\n(\n    INVOICE_NUMBER\n)\nVALUES\n(\n    'INV-1'\n);", tablesUsed: ['IA_INVOICE'], columnsUsed: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filtersApplied: [], assumptions: [] };
  var opt = OPT.optimizeSql(engine, result);
  assertFalse(opt.hasChanges); assertEqual(opt.recommendations.length, 0);
});
test('a clean, already-good query with no issues produces zero changes and zero recommendations', function () {
  var result = { sql: 'SELECT TOP 10 IA_INVOICE.INVOICE_NUMBER\nFROM IA_INVOICE\nWHERE IA_INVOICE.INVOICE_ID = 100', tablesUsed: ['IA_INVOICE'], columnsUsed: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filtersApplied: ['Filter: IA_INVOICE.INVOICE_ID = 100'], assumptions: [] };
  var opt = OPT.optimizeSql(engine, result);
  assertFalse(opt.hasChanges); assertEqual(opt.recommendations.length, 0);
});
