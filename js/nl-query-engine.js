(function (root) {
  'use strict';
  var DATATYPE = (typeof module === 'object' && module.exports) ? require('./datatype-engine.js') : root.APSQL_DATATYPE;

  function tokenizeWords(text) { return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []; }
  function normalizeSpaces(s) { return String(s || '').toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function containsPhrase(haystackLower, phrase) { if (!phrase) return false; return haystackLower.indexOf(phrase) !== -1; }
  function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function cleanValue(raw) {
    if (raw == null) return '';
    var v = String(raw).trim();
    if ((v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') || (v.charAt(0) === "'" && v.charAt(v.length - 1) === "'")) v = v.slice(1, -1);
    v = v.replace(/[.,;]+$/, '');
    return v;
  }
  function bareTableName(tableName) {
    var idx = tableName.indexOf('_');
    var withoutModule = idx !== -1 ? tableName.slice(idx + 1) : tableName;
    return normalizeSpaces(withoutModule);
  }

  var VALUE_RE = '("[^"]*"|\'[^\']*\'|-?\\d+\\.\\d+|-?\\d+|[A-Za-z][A-Za-z0-9_\\-]*)';

  function scoreAllTables(text, engine) {
    var textLower = String(text || '').toLowerCase();
    var labels = engine.getModuleLabels();
    return engine.getAllTables().map(function (t) {
      var score = 0;
      var bare = bareTableName(t.name);
      if (bare && containsPhrase(textLower, bare)) score += 4;
      var rawPhrase = normalizeSpaces(t.name);
      if (rawPhrase && containsPhrase(textLower, rawPhrase)) score += 5;
      var moduleLabel = labels[t.module];
      if (moduleLabel && containsPhrase(textLower, normalizeSpaces(moduleLabel))) score += 1;
      return { table: t, score: score };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  function matchColumns(text, engine, tableNames, opts) {
    opts = opts || {};
    var threshold = opts.threshold != null ? opts.threshold : 2.5;
    var maxPerTable = opts.maxPerTable != null ? opts.maxPerTable : 8;
    var textLower = String(text || '').toLowerCase();
    var out = [];
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table) return;
      var scored = table.columns.map(function (c) {
        var score = 0;
        var namePhrase = normalizeSpaces(c.name);
        if (namePhrase && containsPhrase(textLower, namePhrase)) score += 5;
        if (c.alias) { var aliasPhrase = normalizeSpaces(c.alias); if (aliasPhrase && containsPhrase(textLower, aliasPhrase)) score += 4; }
        return { col: c, score: score };
      });
      scored.sort(function (a, b) { return b.score - a.score; });
      scored.filter(function (s) { return s.score >= threshold; }).slice(0, maxPerTable).forEach(function (s) {
        var entry = { table: tname, column: s.col.name };
        if (s.col.alias) entry.alias = s.col.alias;
        out.push(entry);
      });
    });
    return out;
  }

  function findColumnByPhrase(engine, tableNames, phrase) {
    var best = null;
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table || best) return;
      table.columns.forEach(function (col) {
        if (best) return;
        var namePhrase = normalizeSpaces(col.name);
        var aliasPhrase = col.alias ? normalizeSpaces(col.alias) : '';
        if (namePhrase === phrase || aliasPhrase === phrase) best = { table: tname, column: col.name };
      });
    });
    if (best) return best;
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table || best) return;
      table.columns.forEach(function (col) {
        if (best) return;
        var namePhrase = normalizeSpaces(col.name);
        var aliasPhrase = col.alias ? normalizeSpaces(col.alias) : '';
        if ((namePhrase && phrase.indexOf(namePhrase) !== -1) || (aliasPhrase && phrase.indexOf(aliasPhrase) !== -1)) best = { table: tname, column: col.name };
      });
    });
    return best;
  }

  var OPERATOR_DEFS = [
    { operator: 'between', arity: 2, re: 'between\\s+' + VALUE_RE + '\\s+and\\s+' + VALUE_RE },
    { operator: 'gte', arity: 1, re: '(?:greater than or equal to|at least)\\s+' + VALUE_RE },
    { operator: 'lte', arity: 1, re: '(?:less than or equal to|at most)\\s+' + VALUE_RE },
    { operator: 'gt', arity: 1, re: '(?:greater than|more than|over|above)\\s+' + VALUE_RE },
    { operator: 'lt', arity: 1, re: '(?:less than|under|below)\\s+' + VALUE_RE },
    { operator: 'not_contains', arity: 1, re: '(?:does not contain|not containing|not contain)\\s+' + VALUE_RE },
    { operator: 'contains', arity: 1, re: '(?:contains|containing)\\s+' + VALUE_RE },
    { operator: 'starts_with', arity: 1, re: 'starts?\\s+with\\s+' + VALUE_RE },
    { operator: 'ends_with', arity: 1, re: 'ends?\\s+with\\s+' + VALUE_RE },
    { operator: 'neq', arity: 1, re: '(?:is not|not equal to)\\s+' + VALUE_RE },
    { operator: 'eq', arity: 1, re: '(?:is|equals?|=)\\s+' + VALUE_RE }
  ];

  function findBestDateColumn(engine, tableNames, usedColumns) {
    var candidates = [];
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table) return;
      table.columns.forEach(function (col) {
        var key = tname + '.' + col.name;
        if (usedColumns[key]) return;
        var category = DATATYPE ? DATATYPE.classify(col.type) : 'unknown';
        if (category === 'date' || category === 'timestamp') candidates.push({ table: tname, column: col.name, name: col.name });
      });
    });
    if (!candidates.length) return null;
    var withDateWord = candidates.filter(function (c) { return /date/i.test(c.name); });
    return withDateWord[0] || candidates[0];
  }

  function matchFilters(text, engine, tableNames, now) {
    text = String(text || '');
    var textLower = text.toLowerCase();
    var conditions = [];
    var usedColumns = {};
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table) return;
      table.columns.forEach(function (col) {
        var key = tname + '.' + col.name;
        if (usedColumns[key]) return;
        var phrases = [normalizeSpaces(col.name)];
        if (col.alias) phrases.push(normalizeSpaces(col.alias));
        for (var p = 0; p < phrases.length; p++) {
          var phrase = phrases[p];
          if (!phrase) continue;
          var found = false;
          for (var i = 0; i < OPERATOR_DEFS.length; i++) {
            var def = OPERATOR_DEFS[i];
            var fullRe = new RegExp(escapeRegExp(phrase).replace(/ /g, '\\s+') + '\\s+' + def.re, 'i');
            var m = text.match(fullRe);
            if (m) {
              var value = cleanValue(m[1]);
              var value2 = def.arity === 2 ? cleanValue(m[2]) : undefined;
              var cond = { table: tname, column: col.name, operator: def.operator, value: value };
              if (value2 !== undefined) cond.value2 = value2;
              conditions.push(cond);
              usedColumns[key] = true;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      });
    });
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table) return;
      table.columns.forEach(function (col) {
        var key = tname + '.' + col.name;
        if (usedColumns[key] || !Array.isArray(col.decode)) return;
        for (var i = 0; i < col.decode.length; i++) {
          var pair = col.decode[i];
          var labelPhrase = normalizeSpaces(pair.label);
          if (labelPhrase.length > 2 && textLower.indexOf(labelPhrase) !== -1) {
            conditions.push({ table: tname, column: col.name, operator: 'eq', value: pair.code });
            usedColumns[key] = true;
            break;
          }
        }
      });
    });
    var lastDaysMatch = textLower.match(/last\s+(\d+)\s+days?/);
    if (lastDaysMatch && DATATYPE) {
      var n = parseInt(lastDaysMatch[1], 10);
      var dateCol = findBestDateColumn(engine, tableNames, usedColumns);
      if (dateCol) {
        var nowDate = now || new Date();
        var cutoff = new Date(nowDate.getTime() - n * 24 * 60 * 60 * 1000);
        var iso = cutoff.toISOString().slice(0, 10);
        conditions.push({ table: dateCol.table, column: dateCol.column, operator: 'gte', value: iso });
        usedColumns[dateCol.table + '.' + dateCol.column] = true;
      }
    }
    return conditions;
  }

  function matchSort(text, engine, tableNames) {
    var textLower = String(text || '').toLowerCase();
    var re = /(?:sorted by|order(?:ed)? by|sort by)\s+([a-z0-9 _]+?)(?=(?:\s*,|\s+and\b|\s+ascending|\s+asc\b|\s+descending|\s+desc\b|\s+newest|\s+oldest|\s+highest|\s+lowest|\s+largest|\s+smallest|[.;]|$))/g;
    var out = []; var m;
    while ((m = re.exec(textLower))) {
      var phrase = normalizeSpaces(m[1]);
      var col = findColumnByPhrase(engine, tableNames, phrase);
      if (!col) continue;
      var tail = textLower.slice(m.index, m.index + m[0].length + 24);
      var direction = /descending|desc\b|newest|highest|largest|most recent/.test(tail) ? 'DESC' : 'ASC';
      out.push({ table: col.table, column: col.column, direction: direction });
    }
    return out;
  }
  function matchLimit(text) {
    var m = String(text || '').toLowerCase().match(/\b(?:top|first|only)\s+(\d+)\b/);
    return m ? parseInt(m[1], 10) : null;
  }
  function matchDistinct(text) {
    return /\b(distinct|unique|no duplicates|without duplicates|remove duplicates|deduplicated?)\b/i.test(String(text || ''));
  }
  function matchHierarchy(text, engine, candidateTableNames) {
    if (!/\b(hierarchy|org chart|organi[sz]ation chart|reporting chain|manager chain|supervisor chain|chain of command)\b/i.test(String(text || ''))) return null;
    var selfRefTables = engine.getAllTables().filter(function (t) { return engine.getSelfReferencingEdges(t.name).length > 0; }).map(function (t) { return t.name; });
    if (!selfRefTables.length) return null;
    if (selfRefTables.length === 1) return selfRefTables[0];
    var inCandidates = selfRefTables.filter(function (t) { return candidateTableNames.indexOf(t) !== -1; });
    if (inCandidates.length === 1) return inCandidates[0];
    var textLower = String(text || '').toLowerCase();
    var scored = selfRefTables.map(function (t) {
      var bareWords = bareTableName(t).split(' ').filter(Boolean);
      var overlap = bareWords.filter(function (w) { return textLower.indexOf(w) !== -1; }).length;
      return { table: t, overlap: overlap };
    }).sort(function (a, b) { return b.overlap - a.overlap; });
    if (scored[0].overlap > 0 && (scored.length === 1 || scored[0].overlap > scored[1].overlap)) return scored[0].table;
    return null;
  }

  function describeOperatorForDisplay(c) {
    switch (c.operator) {
      case 'eq': return '= ' + c.value;
      case 'neq': return '<> ' + c.value;
      case 'gt': return '> ' + c.value;
      case 'lt': return '< ' + c.value;
      case 'gte': return '>= ' + c.value;
      case 'lte': return '<= ' + c.value;
      case 'contains': return 'contains "' + c.value + '"';
      case 'not_contains': return 'does not contain "' + c.value + '"';
      case 'starts_with': return 'starts with "' + c.value + '"';
      case 'ends_with': return 'ends with "' + c.value + '"';
      case 'between': return 'between ' + c.value + ' and ' + c.value2;
      default: return String(c.operator);
    }
  }

  function emptyInterpretation(warnings) {
    return { tables: [], columns: [], filterConditions: [], orderBy: [], limit: null, distinct: false, hierarchyTable: null, matched: [], warnings: warnings || [] };
  }

  function interpretDescription(text, engine, opts) {
    opts = opts || {};
    var now = opts.now || new Date();
    text = String(text || '');
    if (!text.trim()) return emptyInterpretation();

    var ranked = scoreAllTables(text, engine).filter(function (s) { return s.score >= 1; });
    var candidateNames = ranked.map(function (s) { return s.table.name; });

    var hierarchyTable = matchHierarchy(text, engine, candidateNames);
    if (hierarchyTable) {
      return { tables: [hierarchyTable], columns: [], filterConditions: [], orderBy: [], limit: null, distinct: false, hierarchyTable: hierarchyTable, matched: ['Hierarchy: ' + hierarchyTable], warnings: [] };
    }

    if (!ranked.length) return emptyInterpretation(['Could not identify any tables mentioned in your description. Try naming a table explicitly, or select tables manually below.']);

    var columns = matchColumns(text, engine, candidateNames, {});
    var filterConditions = matchFilters(text, engine, candidateNames, now);
    var orderBy = matchSort(text, engine, candidateNames);
    var limit = matchLimit(text);
    var distinct = matchDistinct(text);

    var tablesWithPurpose = {};
    columns.forEach(function (c) { tablesWithPurpose[c.table] = true; });
    filterConditions.forEach(function (c) { tablesWithPurpose[c.table] = true; });
    orderBy.forEach(function (o) { tablesWithPurpose[o.table] = true; });
    tablesWithPurpose[ranked[0].table.name] = true;

    var finalTables = candidateNames.filter(function (t) { return tablesWithPurpose[t]; });
    var finalColumns = columns.filter(function (c) { return finalTables.indexOf(c.table) !== -1; });
    var finalFilters = filterConditions.filter(function (c) { return finalTables.indexOf(c.table) !== -1; });
    var finalOrderBy = orderBy.filter(function (o) { return finalTables.indexOf(o.table) !== -1; });

    var matched = [];
    finalTables.forEach(function (t) { matched.push('Table: ' + t); });
    finalColumns.forEach(function (c) { matched.push('Column: ' + c.table + '.' + c.column + (c.alias ? (' (as ' + c.alias + ')') : '')); });
    finalFilters.forEach(function (c) { matched.push('Filter: ' + c.table + '.' + c.column + ' ' + describeOperatorForDisplay(c)); });
    finalOrderBy.forEach(function (o) { matched.push('Sort: ' + o.table + '.' + o.column + ' (' + (o.direction === 'DESC' ? 'largest/latest first' : 'smallest/earliest first') + ')'); });
    if (limit) matched.push('Limit: ' + limit);
    if (distinct) matched.push('Remove duplicates: yes');

    return { tables: finalTables, columns: finalColumns, filterConditions: finalFilters, orderBy: finalOrderBy, limit: limit, distinct: distinct, hierarchyTable: null, matched: matched, warnings: [] };
  }

  function detectCrCommand(text) {
    var textLower = String(text || '').toLowerCase();
    var patterns = [
      { re: /\b(delete|remove|get rid of)\b/, command: 'DELETE' },
      { re: /\b(update|change|modify|correct)\b/, command: 'UPDATE' },
      { re: /\b(insert|add|create)\b/, command: 'INSERT' }
    ];
    var best = null, bestIdx = Infinity;
    patterns.forEach(function (p) { var m = textLower.match(p.re); if (m && m.index < bestIdx) { bestIdx = m.index; best = p.command; } });
    return best;
  }

  function matchColumnValueAssignments(searchText, engine, tableName) {
    var table = engine.getTable(tableName); if (!table) return [];
    var out = []; var used = {};
    table.columns.forEach(function (col) {
      if (used[col.name]) return;
      var phrases = [normalizeSpaces(col.name)];
      if (col.alias) phrases.push(normalizeSpaces(col.alias));
      for (var p = 0; p < phrases.length; p++) {
        var phrase = phrases[p]; if (!phrase) continue;
        var patterns = [
          'set\\s+' + escapeRegExp(phrase).replace(/ /g, '\\s+') + '\\s+to\\s+' + VALUE_RE,
          escapeRegExp(phrase).replace(/ /g, '\\s+') + '\\s+to\\s+' + VALUE_RE,
          escapeRegExp(phrase).replace(/ /g, '\\s+') + '\\s*=\\s*' + VALUE_RE,
          escapeRegExp(phrase).replace(/ /g, '\\s+') + '\\s+is\\s+' + VALUE_RE
        ];
        var matchedHere = false;
        for (var i = 0; i < patterns.length; i++) {
          var m = searchText.match(new RegExp(patterns[i], 'i'));
          if (m) { out.push({ name: col.name, column: col.name, value: cleanValue(m[1]) }); used[col.name] = true; matchedHere = true; break; }
        }
        if (matchedHere) break;
      }
    });
    return out;
  }

  function interpretCrDescription(text, engine, opts) {
    opts = opts || {};
    text = String(text || '');
    if (!text.trim()) return { command: null, table: null, insertColumns: [], updateColumns: [], filterConditions: [], matched: [], warnings: [] };

    var command = detectCrCommand(text);
    var ranked = scoreAllTables(text, engine).filter(function (s) { return s.score >= 1; });
    var table = ranked.length ? ranked[0].table.name : null;

    var whereMatch = text.match(/\bwhere\b/i);
    var assignmentText = whereMatch ? text.slice(0, whereMatch.index) : text;
    var filterText = whereMatch ? text.slice(whereMatch.index) : text;

    var matched = [];
    if (command) matched.push('Query Type: ' + command);
    if (table) matched.push('Table: ' + table);

    var insertColumns = [], updateColumns = [], filterConditions = [];
    if (table && command === 'INSERT') {
      insertColumns = matchColumnValueAssignments(assignmentText, engine, table).map(function (c) { return { name: c.name, value: c.value }; });
      insertColumns.forEach(function (c) { matched.push('Value: ' + c.name + ' = ' + c.value); });
    } else if (table && command === 'UPDATE') {
      updateColumns = matchColumnValueAssignments(assignmentText, engine, table).map(function (c) { return { column: c.column, value: c.value }; });
      updateColumns.forEach(function (c) { matched.push('Set: ' + c.column + ' = ' + c.value); });
    }
    if (table && (command === 'UPDATE' || command === 'DELETE')) {
      filterConditions = matchFilters(filterText, engine, [table], opts.now);
      filterConditions.forEach(function (c) { matched.push('Filter: ' + c.table + '.' + c.column + ' ' + describeOperatorForDisplay(c)); });
    }
    return { command: command, table: table, insertColumns: insertColumns, updateColumns: updateColumns, filterConditions: filterConditions, matched: matched, warnings: [] };
  }

  function dedupeStrings(arr) {
    var seen = {}; var out = [];
    (arr || []).forEach(function (s) { var k = String(s).toUpperCase(); if (!seen[k]) { seen[k] = true; out.push(s); } });
    return out;
  }
  function mergeTableLists(manualTables, nlTables) { return dedupeStrings((manualTables || []).concat(nlTables || [])); }
  function mergeColumnLists(manualColumns, nlColumns) {
    var tablesWithManual = {};
    (manualColumns || []).forEach(function (c) { tablesWithManual[String(c.table).toUpperCase()] = true; });
    var existingKeys = {};
    (manualColumns || []).forEach(function (c) { existingKeys[String(c.table).toUpperCase() + '.' + String(c.column).toUpperCase()] = true; });
    var additions = (nlColumns || []).filter(function (c) {
      var tKey = String(c.table).toUpperCase();
      var cKey = tKey + '.' + String(c.column).toUpperCase();
      if (tablesWithManual[tKey]) return false;
      if (existingKeys[cKey]) return false;
      existingKeys[cKey] = true;
      return true;
    });
    return (manualColumns || []).concat(additions);
  }
  function mergeFilterConditions(manualConditions, nlConditions) {
    function keyOf(c) { return [c.table, c.column, c.operator, c.value, c.value2].map(function (x) { return String(x == null ? '' : x).toUpperCase(); }).join('|'); }
    var existing = {}; (manualConditions || []).forEach(function (c) { existing[keyOf(c)] = true; });
    var additions = (nlConditions || []).filter(function (c) { var k = keyOf(c); if (existing[k]) return false; existing[k] = true; return true; });
    return (manualConditions || []).concat(additions);
  }

  var API = {
    interpretDescription: interpretDescription,
    interpretCrDescription: interpretCrDescription,
    mergeTableLists: mergeTableLists,
    mergeColumnLists: mergeColumnLists,
    mergeFilterConditions: mergeFilterConditions,
    scoreAllTables: scoreAllTables, matchColumns: matchColumns, matchFilters: matchFilters,
    matchSort: matchSort, matchLimit: matchLimit, matchDistinct: matchDistinct, matchHierarchy: matchHierarchy,
    detectCrCommand: detectCrCommand, matchColumnValueAssignments: matchColumnValueAssignments,
    bareTableName: bareTableName, normalizeSpaces: normalizeSpaces
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.APSQL_NLQUERY = API;
})(typeof window !== 'undefined' ? window : this);
