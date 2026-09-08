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
test('buildDecodeCaseSql exact shape (legacy 4-arg call, no opts — unchanged pre-V10 behavior)', function () { assertEqual(DECODE.buildDecodeCaseSql('', 'S', [{ code: '1', label: 'A' }], 'S'), "CASE\n    WHEN S = 1 THEN 'A'\n    ELSE S\nEND AS S"); });

/* ---- V10.0: data-type- and dialect-aware ELSE handling ---- */
test('V10: numeric column + Oracle dialect -> ELSE TO_CHAR(col)', function () {
  var sql = DECODE.buildDecodeCaseSql('ADM_USER_DATA', 'LOGIN_TYPE', [{ code: '0', label: 'Forms' }, { code: '1', label: 'Windows Domain' }], 'LOGIN_TYPE', { dataType: 'NUMBER(5)', dialect: 'Oracle' });
  assertEqual(sql, "CASE\n    WHEN ADM_USER_DATA.LOGIN_TYPE = 0 THEN 'Forms'\n    WHEN ADM_USER_DATA.LOGIN_TYPE = 1 THEN 'Windows Domain'\n    ELSE TO_CHAR(ADM_USER_DATA.LOGIN_TYPE)\nEND AS LOGIN_TYPE");
});
test('V10: exact spec worked example reproduced verbatim for all 5 decode values', function () {
  var values = [
    { code: '0', label: 'Forms' }, { code: '1', label: 'Windows Domain (deprecated)' }, { code: '2', label: 'Alusta Single-Sign-On' },
    { code: '4', label: 'Basware Access' }, { code: '99', label: 'Inherited from home organization unit' }
  ];
  var sql = DECODE.buildDecodeCaseSql('', 'LOGIN_TYPE', values, 'LOGIN_TYPE', { dataType: 'NUMBER(5)', dialect: 'Oracle' });
  assertIncludes(sql, "ELSE TO_CHAR(LOGIN_TYPE)");
  assertIncludes(sql, "WHEN LOGIN_TYPE = 99 THEN 'Inherited from home organization unit'");
});
test('V10: same numeric column across all 5 dialects produces 5 distinct, idiomatic ELSE expressions', function () {
  var base = { dataType: 'NUMBER(5)' };
  function elseOf(dialect) { var sql = DECODE.buildDecodeCaseSql('', 'LOGIN_TYPE', [{ code: '0', label: 'Forms' }], 'LOGIN_TYPE', { dataType: base.dataType, dialect: dialect }); return sql.split('\n').filter(function (l) { return /^\s*ELSE/.test(l); })[0].trim(); }
  assertEqual(elseOf('Oracle'), 'ELSE TO_CHAR(LOGIN_TYPE)');
  assertEqual(elseOf('SQL Server'), 'ELSE CONVERT(VARCHAR(4000), LOGIN_TYPE)');
  assertEqual(elseOf('PostgreSQL'), 'ELSE LOGIN_TYPE::text');
  assertEqual(elseOf('MySQL'), 'ELSE CAST(LOGIN_TYPE AS CHAR)');
  assertEqual(elseOf('Generic'), 'ELSE CAST(LOGIN_TYPE AS VARCHAR(4000))');
});
test('V10: text column data type -> ELSE stays the plain column reference (no wrapping, matches pre-V10 shape exactly)', function () {
  var sql = DECODE.buildDecodeCaseSql('IA_SUPPLIER', 'SUPPLIER_NAME', [{ code: 'A', label: 'Alpha' }], 'SUPPLIER_NAME', { dataType: 'VARCHAR2(250)', dialect: 'Oracle' });
  assertIncludes(sql, 'ELSE IA_SUPPLIER.SUPPLIER_NAME');
  assertFalse(/TO_CHAR/.test(sql));
});
test('V10: elseMode "keep" overrides data-type conversion even for a numeric column', function () {
  var sql = DECODE.buildDecodeCaseSql('', 'LOGIN_TYPE', [{ code: '0', label: 'Forms' }], 'LOGIN_TYPE', { dataType: 'NUMBER(5)', dialect: 'Oracle', elseMode: 'keep' });
  assertIncludes(sql, 'ELSE LOGIN_TYPE');
  assertFalse(/TO_CHAR/.test(sql));
});
test('V10: missing dataType (schema has no type info) preserves old behavior regardless of elseMode', function () {
  var sql = DECODE.buildDecodeCaseSql('', 'X', [{ code: '0', label: 'A' }], 'X', { dataType: null, dialect: 'Oracle', elseMode: 'convert' });
  assertIncludes(sql, 'ELSE X');
  assertFalse(/TO_CHAR/.test(sql));
});
test('V10: unrecognized-but-present dataType also preserves old behavior (does not invent a conversion)', function () {
  var sql = DECODE.buildDecodeCaseSql('', 'X', [{ code: '0', label: 'A' }], 'X', { dataType: 'SOME_WEIRD_TYPE', dialect: 'Oracle' });
  assertIncludes(sql, 'ELSE X');
});
test('V10: calling with no 5th argument at all behaves identically to the pre-V10 signature', function () {
  var withOpts = DECODE.buildDecodeCaseSql('T', 'C', [{ code: '1', label: 'A' }], 'ALIAS');
  var legacy = "CASE\n    WHEN T.C = 1 THEN 'A'\n    ELSE T.C\nEND AS ALIAS";
  assertEqual(withOpts, legacy);
});
