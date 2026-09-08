'use strict';
var path = require('path');
var schema = require(path.join(__dirname, '..', 'schema', 'schema-sample.js'));
var SCHEMA_ENGINE = require(path.join(__dirname, '..', 'js', 'schema-engine.js'));
var DECODE = require(path.join(__dirname, '..', 'js', 'decode-engine.js'));
test('resolveDecode schema source', function () { var e = SCHEMA_ENGINE.createEngine(schema), s = DECODE.createDecodeStore(); assertEqual(DECODE.resolveDecode(e, s, 'IA_INVOICE', 'STATUS').source, 'schema'); });
test('manual decode only when no schema decode', function () {
  var e = SCHEMA_ENGINE.createEngine(schema), s = DECODE.createDecodeStore();
  s.setManualDecode('IA_INVOICE', 'INVOICE_NUMBER', [{ code: 'X', label: 'Y' }]);
  assertEqual(DECODE.resolveDecode(e, s, 'IA_INVOICE', 'INVOICE_NUMBER').source, 'user');
  s.setManualDecode('IA_INVOICE', 'STATUS', [{ code: '9', label: 'Nope' }]);
  assertEqual(DECODE.resolveDecode(e, s, 'IA_INVOICE', 'STATUS').source, 'schema');
});
test('decode store add/edit/remove/clear', function () { var s = DECODE.createDecodeStore(); s.addValue('T', 'C', '1', 'A'); s.addValue('T', 'C', '0', 'B'); assertEqual(s.getManualDecode('T', 'C').length, 2); s.removeValue('T', 'C', 0); assertEqual(s.getManualDecode('T', 'C').length, 1); s.clearManualDecode('T', 'C'); assertEqual(s.getManualDecode('T', 'C'), null); });
test('buildDecodeCaseSql exact shape (legacy 4-arg call, no opts)', function () { assertEqual(DECODE.buildDecodeCaseSql('', 'S', [{ code: '1', label: 'A' }], 'S'), "CASE\n    WHEN S = 1 THEN 'A'\n    ELSE S\nEND AS S"); });
test('V10: numeric column + Oracle dialect -> ELSE TO_CHAR(col)', function () {
  var sql = DECODE.buildDecodeCaseSql('ADM_USER_DATA', 'LOGIN_TYPE', [{ code: '0', label: 'Forms' }], 'LOGIN_TYPE', { dataType: 'NUMBER(5)', dialect: 'Oracle' });
  assertIncludes(sql, 'ELSE TO_CHAR(ADM_USER_DATA.LOGIN_TYPE)');
});
test('V10: text column data type -> ELSE stays the plain column reference', function () {
  var sql = DECODE.buildDecodeCaseSql('IA_SUPPLIER', 'SUPPLIER_NAME', [{ code: 'A', label: 'Alpha' }], 'SUPPLIER_NAME', { dataType: 'VARCHAR2(250)', dialect: 'Oracle' });
  assertIncludes(sql, 'ELSE IA_SUPPLIER.SUPPLIER_NAME');
  assertFalse(/TO_CHAR/.test(sql));
});
test('V10: elseMode "keep" overrides data-type conversion', function () {
  var sql = DECODE.buildDecodeCaseSql('', 'LOGIN_TYPE', [{ code: '0', label: 'Forms' }], 'LOGIN_TYPE', { dataType: 'NUMBER(5)', dialect: 'Oracle', elseMode: 'keep' });
  assertIncludes(sql, 'ELSE LOGIN_TYPE');
  assertFalse(/TO_CHAR/.test(sql));
});
