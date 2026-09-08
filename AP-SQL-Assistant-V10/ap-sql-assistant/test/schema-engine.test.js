'use strict';
var path = require('path');
var schema = require(path.join(__dirname, '..', 'schema', 'schema-sample.js'));
var APSQL = require(path.join(__dirname, '..', 'js', 'schema-engine.js'));
test('createEngine throws without valid schema', function () { assertThrows(function () { APSQL.createEngine(null); }); });
test('getAllTables returns every table', function () { assertTrue(APSQL.createEngine(schema).getAllTables().length >= 10); });
test('getTable case-insensitive', function () { var e = APSQL.createEngine(schema); assertTrue(e.getTable('ia_invoice') !== null); assertEqual(e.getTable('nope'), null); });
test('tableExists/columnExists', function () { var e = APSQL.createEngine(schema); assertTrue(e.tableExists('IA_INVOICE')); assertFalse(e.tableExists('NOPE')); assertTrue(e.columnExists('IA_INVOICE', 'STATUS')); });
test('getValueMap schema decode', function () { assertEqual(APSQL.createEngine(schema).getValueMap('IA_INVOICE', 'STATUS').length, 4); });
test('getSelfReferencingEdges', function () { assertEqual(APSQL.createEngine(schema).getSelfReferencingEdges('ADM_USER_DATA')[0].fromColumn, 'SUPERVISOR_USER_ID'); });
test('findRelationship both directions', function () { var e = APSQL.createEngine(schema); assertTrue(e.findRelationship('IA_INVOICE', 'IA_SUPPLIER') !== null); assertTrue(e.findRelationship('IA_SUPPLIER', 'IA_INVOICE') !== null); });
test('getStatus counts', function () { assertEqual(APSQL.createEngine(schema).getStatus().tableCount, schema.tables.length); });
test('LOGIN_TYPE column present on ADM_USER_DATA with NUMBER type and decode (V10 worked example fixture)', function () {
  var e = APSQL.createEngine(schema);
  var col = e.getColumn('ADM_USER_DATA', 'LOGIN_TYPE');
  assertTrue(col !== null);
  assertIncludes(col.type, 'NUMBER');
  assertEqual(col.decode.length, 5);
});
