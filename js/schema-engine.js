(function (root) {
  'use strict';
  function createEngine(schema) {
    if (!schema || !Array.isArray(schema.tables)) throw new Error('createEngine() requires a schema object with a "tables" array.');
    var tablesByName = {};
    schema.tables.forEach(function (t) { tablesByName[String(t.name).toUpperCase()] = t; });
    function getModuleLabels() { return schema.module_labels || {}; }
    function getAllTables() { return schema.tables.slice(); }
    function getTable(name) { if (!name) return null; return tablesByName[String(name).toUpperCase()] || null; }
    function getColumn(tableName, columnName) {
      var t = getTable(tableName); if (!t) return null;
      var upper = String(columnName).toUpperCase();
      for (var i = 0; i < t.columns.length; i++) if (String(t.columns[i].name).toUpperCase() === upper) return t.columns[i];
      return null;
    }
    function tableExists(name) { return !!getTable(name); }
    function columnExists(tableName, columnName) { return !!getColumn(tableName, columnName); }
    function getValueMap(tableName, columnName) { var c = getColumn(tableName, columnName); return (c && Array.isArray(c.decode)) ? c.decode.slice() : null; }
    function getSelfReferencingEdges(tableName) {
      var t = getTable(tableName); if (!t) return [];
      var out = [];
      t.columns.forEach(function (c) { if (c.foreign_key && String(c.foreign_key.table).toUpperCase() === String(tableName).toUpperCase()) out.push({ fromColumn: c.name, toTable: c.foreign_key.table, toColumn: c.foreign_key.column }); });
      return out;
    }
    function findRelationship(tableA, tableB) {
      var a = getTable(tableA), b = getTable(tableB); if (!a || !b) return null;
      for (var i = 0; i < a.columns.length; i++) { var fk = a.columns[i].foreign_key; if (fk && String(fk.table).toUpperCase() === String(tableB).toUpperCase()) return { fromTable: a.name, fromColumn: a.columns[i].name, toTable: fk.table, toColumn: fk.column }; }
      for (var j = 0; j < b.columns.length; j++) { var fk2 = b.columns[j].foreign_key; if (fk2 && String(fk2.table).toUpperCase() === String(tableA).toUpperCase()) return { fromTable: b.name, fromColumn: b.columns[j].name, toTable: fk2.table, toColumn: fk2.column }; }
      return null;
    }
    function getStatus() {
      var moduleSet = {}; var columnCount = 0;
      schema.tables.forEach(function (t) { moduleSet[t.module] = true; columnCount += t.columns.length; });
      return { schemaName: schema.schema_name || 'Database Schema', schemaVersion: schema.schema_version || '1.0', status: 'valid', moduleCount: Object.keys(moduleSet).length, tableCount: schema.tables.length, columnCount: columnCount, sourceDocuments: schema.source_documents || [], lastUpdated: schema.last_updated || '', lastValidated: schema.last_updated || '', appVersion: '10.2.0' };
    }
    return { getModuleLabels: getModuleLabels, getAllTables: getAllTables, getTable: getTable, getColumn: getColumn, tableExists: tableExists, columnExists: columnExists, getValueMap: getValueMap, getSelfReferencingEdges: getSelfReferencingEdges, findRelationship: findRelationship, getStatus: getStatus, _schema: schema };
  }
  var API = { createEngine: createEngine };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.APSQL = Object.assign(root.APSQL || {}, API);
})(typeof window !== 'undefined' ? window : this);
