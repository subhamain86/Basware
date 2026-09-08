(function (root) {
  'use strict';
  var DATATYPE = (typeof module === 'object' && module.exports) ? require('./datatype-engine.js') : root.APSQL_DATATYPE;

  function createDecodeStore() {
    var manual = {};
    function key(table, column) { return String(table).toUpperCase() + '.' + String(column).toUpperCase(); }
    function setManualDecode(table, column, values) { manual[key(table, column)] = (values || []).map(function (v) { return { code: String(v.code), label: String(v.label) }; }); }
    function clearManualDecode(table, column) { delete manual[key(table, column)]; }
    function getManualDecode(table, column) { return manual[key(table, column)] || null; }
    function addValue(table, column, code, label) { var k = key(table, column); if (!manual[k]) manual[k] = []; manual[k].push({ code: String(code), label: String(label) }); return manual[k]; }
    function removeValue(table, column, index) { var k = key(table, column); if (manual[k]) manual[k].splice(index, 1); }
    function editValue(table, column, index, code, label) { var k = key(table, column); if (manual[k] && manual[k][index]) manual[k][index] = { code: String(code), label: String(label) }; }
    return { setManualDecode: setManualDecode, clearManualDecode: clearManualDecode, getManualDecode: getManualDecode, addValue: addValue, removeValue: removeValue, editValue: editValue };
  }
  function resolveDecode(engine, decodeStore, table, column) {
    var schemaValues = engine.getValueMap(table, column);
    if (schemaValues && schemaValues.length) return { source: 'schema', values: schemaValues };
    var manualValues = decodeStore ? decodeStore.getManualDecode(table, column) : null;
    if (manualValues && manualValues.length) return { source: 'user', values: manualValues };
    return { source: null, values: null };
  }

  /**
   * buildDecodeCaseSql(table, column, decodeValues, aliasName, opts)
   * ---------------------------------------------------------------------
   * V10.0: the ELSE branch is now data-type- and dialect-aware. `opts` is
   * an OPTIONAL new parameter — every pre-existing caller that invokes
   * this with only 4 arguments continues to work EXACTLY as before,
   * because with no opts.dataType supplied, elseExpr defaults to the
   * plain column reference, identical to the original V9.x behavior.
   *
   *   opts.dataType — the column's raw schema Data Type string (e.g.
   *                   "NUMBER(5)"), or falsy/omitted if unavailable.
   *   opts.dialect  — the active SQL dialect ('Oracle', 'SQL Server',
   *                   'PostgreSQL', 'MySQL', 'Generic'); defaults to
   *                   'Generic' if omitted.
   *   opts.elseMode — 'convert' (default/safe) or 'keep' (explicit user
   *                   override to preserve the pre-V10 behavior even for
   *                   a non-text column).
   *
   * When opts.dataType is available AND opts.elseMode !== 'keep', the
   * ELSE branch is rewritten to a dialect-appropriate "convert to text"
   * expression via datatype-engine.js — but ONLY when that column's type
   * actually needs it (a text-type column, or a type the schema documents
   * but this module does not recognize, is left completely unchanged,
   * per the "do not invent a data type" requirement).
   */
  function buildDecodeCaseSql(table, column, decodeValues, aliasName, opts) {
    opts = opts || {};
    var col = table ? (table + '.' + column) : column;
    var lines = ['CASE'];
    decodeValues.forEach(function (pair) {
      var isNumeric = /^-?\d+(\.\d+)?$/.test(String(pair.code).trim());
      var literal = isNumeric ? String(pair.code).trim() : ("'" + String(pair.code).replace(/'/g, "''") + "'");
      lines.push('    WHEN ' + col + ' = ' + literal + " THEN '" + String(pair.label).replace(/'/g, "''") + "'");
    });
    var elseExpr = col;
    if (opts.elseMode !== 'keep' && opts.dataType && DATATYPE) {
      elseExpr = DATATYPE.getCompatibleElseExpression(col, opts.dataType, opts.dialect || 'Generic');
    }
    lines.push('    ELSE ' + elseExpr); lines.push('END AS ' + (aliasName || column));
    return lines.join('\n');
  }
  var API = { createDecodeStore: createDecodeStore, resolveDecode: resolveDecode, buildDecodeCaseSql: buildDecodeCaseSql };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.APSQL_DECODE = API;
})(typeof window !== 'undefined' ? window : this);
