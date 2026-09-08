'use strict';
var path = require('path');
var schema = require(path.join(__dirname, '..', 'schema', 'schema-sample.js'));
var SCHEMA_ENGINE = require(path.join(__dirname, '..', 'js', 'schema-engine.js'));
var RELATIONSHIPS = require(path.join(__dirname, '..', 'js', 'relationship-store.js'));
var baseEngine = SCHEMA_ENGINE.createEngine(schema);
test('createRelationshipStore starts empty', function () { var store = RELATIONSHIPS.createRelationshipStore(); assertEqual(store.getManualRelationship('A', 'B'), null); });
test('setManualRelationship / getManualRelationship round-trips, order-independent', function () {
  var store = RELATIONSHIPS.createRelationshipStore();
  store.setManualRelationship('OM_ORDER', 'ORDER_ID', 'IA_INVOICE', 'INVOICE_ID');
  assertEqual(store.getManualRelationship('OM_ORDER', 'IA_INVOICE'), store.getManualRelationship('IA_INVOICE', 'OM_ORDER'));
});
test('clearManualRelationship / clearAll', function () {
  var store = RELATIONSHIPS.createRelationshipStore();
  store.setManualRelationship('A', 'X', 'B', 'Y'); store.clearManualRelationship('A', 'B');
  assertEqual(store.getManualRelationship('A', 'B'), null);
  store.setManualRelationship('C', 'X', 'D', 'Y'); store.clearAll();
  assertEqual(store.listManualRelationships().length, 0);
});
test('createEffectiveEngine falls back to manual relationship when schema has none', function () {
  var store = RELATIONSHIPS.createRelationshipStore();
  store.setManualRelationship('IA_INVOICE', 'COMPANY_ID', 'ADM_USER_DATA', 'USER_ID');
  var eff = RELATIONSHIPS.createEffectiveEngine(baseEngine, store);
  assertTrue(eff.findRelationship('IA_INVOICE', 'ADM_USER_DATA') !== null);
});
test('createEffectiveEngine prefers a real schema relationship over a manual one', function () {
  var store = RELATIONSHIPS.createRelationshipStore();
  store.setManualRelationship('IA_INVOICE', 'SOME_COL', 'IA_SUPPLIER', 'SOME_COL');
  var eff = RELATIONSHIPS.createEffectiveEngine(baseEngine, store);
  assertEqual(eff.findRelationship('IA_INVOICE', 'IA_SUPPLIER').fromColumn, 'SUPPLIER_ID');
});
test('createEffectiveEngine passes through every other method unchanged', function () {
  var eff = RELATIONSHIPS.createEffectiveEngine(baseEngine, RELATIONSHIPS.createRelationshipStore());
  assertEqual(eff.getTable('IA_INVOICE').name, 'IA_INVOICE');
  assertTrue(eff.columnExists('IA_INVOICE', 'STATUS'));
});
