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

  function getCompatibleElseExpression(columnExpr, rawType, dialect) {
    if (!rawType) return columnExpr;
    var category = classify(rawType);
    if (category === 'unknown' || category === 'text') return columnExpr;
    var dialectConverters = CONVERTERS[dialect] || CONVERTERS.Generic;
    var fn = dialectConverters[category];
    if (!fn) return columnExpr;
    return fn(columnExpr);
  }

  function needsConversion(rawType) {
    if (!rawType) return false;
    var category = classify(rawType);
    return category !== 'unknown' && category !== 'text';
  }

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
