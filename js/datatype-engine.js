/**
 * datatype-engine.js — AP-SQL Assistant Version 10.0 (NEW)
 * ---------------------------------------------------------------------------
 * A small, pure, dialect-aware data-type classification and conversion
 * module. It has exactly two jobs:
 *
 *   1) classify(rawType) — given a schema column's raw "Data Type" text
 *      (e.g. "NUMBER(5)", "VARCHAR2(50)", "DATE", "TIMESTAMP", "BOOLEAN"),
 *      classify it into one of a small number of broad categories:
 *      'numeric', 'text', 'date', 'timestamp', 'boolean', or 'unknown'
 *      (meaning the schema DOES document a type, but it isn't one of the
 *      keywords this module recognizes — see the important note below).
 *
 *   2) getCompatibleElseExpression(columnExpr, rawType, dialect) — given a
 *      SQL expression referring to a column (e.g. "LOGIN_TYPE" or
 *      "T.LOGIN_TYPE"), that column's raw data type, and the currently
 *      selected SQL dialect, return a SQL expression that is guaranteed to
 *      evaluate to TEXT, using whatever conversion syntax is correct for
 *      that specific dialect (never hard-coding Oracle's TO_CHAR() for
 *      every database). If the column is already text-like, the original
 *      expression is returned completely unchanged (no wrapping needed).
 *
 * This module is intentionally conservative: if a data type is genuinely
 * unavailable (empty/missing), OR it is present but not one of the
 * keywords recognized below, callers are expected to treat that the same
 * way — i.e. make NO assumption and leave the original expression alone.
 * This module never invents a data type; it only classifies what the
 * schema actually documents. See decode-engine.js and
 * error-rectifier-engine.js for how the two "unavailable" and "unknown"
 * cases are both deliberately treated as "do nothing" by their callers.
 * ---------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var NUMERIC_TYPES = ['NUMBER', 'INTEGER', 'INT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'BIGINT', 'SMALLINT', 'TINYINT', 'REAL', 'MONEY', 'SMALLMONEY', 'BINARY_FLOAT', 'BINARY_DOUBLE'];
  var TEXT_TYPES = ['VARCHAR', 'VARCHAR2', 'NVARCHAR', 'NVARCHAR2', 'CHAR', 'NCHAR', 'TEXT', 'NTEXT', 'STRING', 'CLOB', 'NCLOB', 'LONGTEXT', 'MEDIUMTEXT'];
  var DATE_TYPES = ['DATE'];
  var TIMESTAMP_TYPES = ['TIMESTAMP', 'DATETIME', 'DATETIME2', 'SMALLDATETIME', 'DATETIMEOFFSET'];
  var BOOLEAN_TYPES = ['BOOLEAN', 'BOOL', 'BIT'];

  function baseTypeName(rawType) {
    if (!rawType) return '';
    var m = String(rawType).trim().toUpperCase().match(/^([A-Z_][A-Z0-9_]*)/);
    return m ? m[1] : '';
  }

  /** classify(rawType) -> 'numeric' | 'text' | 'date' | 'timestamp' | 'boolean' | 'unknown' */
  function classify(rawType) {
    var base = baseTypeName(rawType);
    if (!base) return 'unknown';
    if (NUMERIC_TYPES.indexOf(base) !== -1) return 'numeric';
    if (TEXT_TYPES.indexOf(base) !== -1) return 'text';
    if (TIMESTAMP_TYPES.indexOf(base) !== -1) return 'timestamp';
    if (DATE_TYPES.indexOf(base) !== -1) return 'date';
    if (BOOLEAN_TYPES.indexOf(base) !== -1) return 'boolean';
    return 'unknown';
  }

  /**
   * Per-dialect "convert this expression to text" functions, one per
   * recognized category. Every dialect gets its own idiomatic syntax —
   * nothing here defaults to Oracle's TO_CHAR() for a non-Oracle dialect.
   */
  var CONVERTERS = {
    'Oracle': {
      numeric: function (e) { return 'TO_CHAR(' + e + ')'; },
      date: function (e) { return 'TO_CHAR(' + e + ')'; },
      timestamp: function (e) { return 'TO_CHAR(' + e + ')'; },
      boolean: function (e) { return 'TO_CHAR(' + e + ')'; }
    },
    'SQL Server': {
      numeric: function (e) { return 'CONVERT(VARCHAR(4000), ' + e + ')'; },
      date: function (e) { return 'CONVERT(VARCHAR(23), ' + e + ', 120)'; },
      timestamp: function (e) { return 'CONVERT(VARCHAR(23), ' + e + ', 120)'; },
      boolean: function (e) { return 'CONVERT(VARCHAR(5), ' + e + ')'; }
    },
    'PostgreSQL': {
      numeric: function (e) { return e + '::text'; },
      date: function (e) { return "TO_CHAR(" + e + ", 'YYYY-MM-DD')"; },
      timestamp: function (e) { return "TO_CHAR(" + e + ", 'YYYY-MM-DD HH24:MI:SS')"; },
      boolean: function (e) { return e + '::text'; }
    },
    'MySQL': {
      numeric: function (e) { return 'CAST(' + e + ' AS CHAR)'; },
      date: function (e) { return "DATE_FORMAT(" + e + ", '%Y-%m-%d')"; },
      timestamp: function (e) { return "DATE_FORMAT(" + e + ", '%Y-%m-%d %H:%i:%s')"; },
      boolean: function (e) { return 'CAST(' + e + ' AS CHAR)'; }
    },
    'Generic': {
      numeric: function (e) { return 'CAST(' + e + ' AS VARCHAR(4000))'; },
      date: function (e) { return 'CAST(' + e + ' AS VARCHAR(4000))'; },
      timestamp: function (e) { return 'CAST(' + e + ' AS VARCHAR(4000))'; },
      boolean: function (e) { return 'CAST(' + e + ' AS VARCHAR(4000))'; }
    }
  };
  var DIALECTS = Object.keys(CONVERTERS);

  /**
   * getCompatibleElseExpression(columnExpr, rawType, dialect)
   *   columnExpr — the SQL text of the expression to make text-safe, e.g.
   *                "LOGIN_TYPE" or "ADM_USER_DATA.LOGIN_TYPE".
   *   rawType    — the column's raw schema Data Type string, or a falsy
   *                value if unavailable.
   *   dialect    — one of 'Oracle' | 'SQL Server' | 'PostgreSQL' | 'MySQL'
   *                | 'Generic' (falls back to 'Generic' if unrecognized).
   *
   * Returns the ORIGINAL columnExpr unchanged whenever: the type is
   * unavailable, the type is present but unrecognized ('unknown' —
   * deliberately treated the same as unavailable, per the "do not invent"
   * requirement), or the type is already text-like. Otherwise returns a
   * dialect-appropriate "convert to text" expression.
   */
  function getCompatibleElseExpression(columnExpr, rawType, dialect) {
    if (!rawType) return columnExpr;
    var category = classify(rawType);
    if (category === 'unknown' || category === 'text') return columnExpr;
    var dialectConverters = CONVERTERS[dialect] || CONVERTERS.Generic;
    var fn = dialectConverters[category];
    if (!fn) return columnExpr;
    return fn(columnExpr);
  }

  /** True if getCompatibleElseExpression() would actually change columnExpr for this rawType. */
  function needsConversion(rawType) {
    if (!rawType) return false;
    var category = classify(rawType);
    return category !== 'unknown' && category !== 'text';
  }

  /** Dialect-appropriate "parse this text literal as a date" wrapper, used by error-rectifier-engine.js. */
  function wrapDateLiteral(literalSql, dialect) {
    var inner = literalSql.replace(/^'|'$/g, '');
    switch (dialect) {
      case 'Oracle': return "TO_DATE('" + inner + "', 'YYYY-MM-DD')";
      case 'SQL Server': return "CONVERT(DATE, '" + inner + "', 120)";
      case 'PostgreSQL': return "'" + inner + "'::date";
      case 'MySQL': return "STR_TO_DATE('" + inner + "', '%Y-%m-%d')";
      default: return "CAST('" + inner + "' AS DATE)";
    }
  }

  var API = {
    classify: classify, baseTypeName: baseTypeName,
    getCompatibleElseExpression: getCompatibleElseExpression, needsConversion: needsConversion,
    wrapDateLiteral: wrapDateLiteral, DIALECTS: DIALECTS,
    NUMERIC_TYPES: NUMERIC_TYPES, TEXT_TYPES: TEXT_TYPES, DATE_TYPES: DATE_TYPES, TIMESTAMP_TYPES: TIMESTAMP_TYPES, BOOLEAN_TYPES: BOOLEAN_TYPES
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.APSQL_DATATYPE = API;
})(typeof window !== 'undefined' ? window : this);
