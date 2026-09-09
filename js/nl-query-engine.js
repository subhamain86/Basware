(function (root) {
  'use strict';
  var DATATYPE = (typeof module === 'object' && module.exports) ? require('./datatype-engine.js') : root.APSQL_DATATYPE;

  /* =====================================================================
     ---------------------------------------------------------------------
     SECTION 1 — V10.1–V10.5 ENGINE (UNCHANGED)
     Every function below this banner is byte-for-byte identical to the
     V10.5 implementation. It remains fully exported and fully tested so
     that nothing that already worked can regress. The new V10.6
     "intelligent" engine (Section 2, below) is built ADDITIVELY on top —
     it calls some of these helpers internally but never modifies them.
     ---------------------------------------------------------------------
     ===================================================================== */

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
  var MULTI_VALUE_LIST_RE = '((?:"[^"]*"|\'[^\']*\'|[A-Za-z0-9_\\-\\.]+)(?:\\s*,\\s*(?:"[^"]*"|\'[^\']*\'|[A-Za-z0-9_\\-\\.]+))*)';

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
    { operator: 'not_in', arity: 'multi', re: '(?:is not one of|is not any of|not one of)\\s+' + MULTI_VALUE_LIST_RE },
    { operator: 'in', arity: 'multi', re: '(?:is one of|is any of|one of)\\s+' + MULTI_VALUE_LIST_RE },
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
              var cond = { table: tname, column: col.name, operator: def.operator };
              if (def.arity === 2) { cond.value = cleanValue(m[1]); cond.value2 = cleanValue(m[2]); }
              else if (def.arity === 'multi') { cond.value = m[1].trim(); }
              else { cond.value = cleanValue(m[1]); }
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
      case 'in': return 'is one of (' + c.value + ')';
      case 'not_in': return 'is not one of (' + c.value + ')';
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

  /* =====================================================================
     ---------------------------------------------------------------------
     SECTION 2 — V10.6 "INTELLIGENT QUERY BUILDER" ENGINE (NEW)
     Everything below is additive. It reuses Section 1 helpers where
     appropriate but introduces a much richer reasoning pipeline:
       Natural Language -> Schema Analysis -> Table ID -> Column ID ->
       Relationship/JOIN ID -> Filter ID (incl. exclusions, booleans,
       date ranges) -> Aggregation/GROUP BY/HAVING -> SQL construction
       inputs -> confidence/ambiguity reporting -> plain-English
       explanation.
     The master entry points are `interpretRequirement` (Read Only /
     Describe box) and `interpretCrRequirement` (Change Request Describe
     box). Neither replaces nor calls interpretDescription/
     interpretCrDescription — they are independent, newer pipelines.
     ---------------------------------------------------------------------
     ===================================================================== */

  var STOPWORDS = { a: 1, all: 1, an: 1, and: 1, are: 1, as: 1, at: 1, be: 1, by: 1, for: 1, from: 1, in: 1, into: 1, is: 1, it: 1, of: 1, on: 1, or: 1, our: 1, show: 1, that: 1, the: 1, their: 1, them: 1, then: 1, this: 1, to: 1, was: 1, were: 1, where: 1, which: 1, who: 1, whose: 1, with: 1, please: 1, also: 1, only: 1, its: 1 };
  /** tokenize(s) — strips ALL punctuation (not just underscores/hyphens)
   * before splitting into lowercase words, so that description text like
   * "Name of the user group (e.g. Finance, IT, Sales)" tokenizes cleanly
   * into ['name','of','the','user','group','e','g','finance','it','sales']
   * rather than leaving trailing punctuation glued to words. */
  function tokenize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean); }
  function contentTokens(s) { return tokenize(s).filter(function (w) { return w.length >= 3 && !STOPWORDS[w]; }); }
  /** uniqueWords(arr) — de-duplicates a word list. Used whenever we count
   * DISTINCT overlapping concepts against a threshold (e.g. "does this
   * column's description share at least 3 distinct ideas with the
   * request?") — without this, a word the user simply repeated (e.g.
   * "users" appearing twice) would inflate the overlap count and could
   * push an unrelated column over the threshold purely from repetition. */
  function uniqueWords(arr) { var seen = {}; var out = []; (arr || []).forEach(function (w) { if (!seen[w]) { seen[w] = true; out.push(w); } }); return out; }
  /** normalizeWordSet(words) — singularizes EVERY word first, then
   * de-duplicates. This collapses "user" and "users" (or "belong" and
   * "belongs") into a single concept before any overlap counting, so a
   * sentence that happens to use both the singular and plural form of
   * the same word doesn't inflate an overlap count by counting the same
   * underlying idea twice. */
  function normalizeWordSet(words) { return uniqueWords((words || []).map(singularize)); }
  function singularize(word) {
    if (word.length > 4 && word.slice(-3) === 'ies') return word.slice(0, -3) + 'y';
    if (word.length > 3 && word.slice(-2) === 'es' && /[sxz]es$|[cs]hes$/.test(word)) return word.slice(0, -2);
    if (word.length > 3 && word.slice(-1) === 's' && word.slice(-2) !== 'ss') return word.slice(0, -1);
    return word;
  }

  /**
   * normalizeThousandsSeparators(text) — rewrites obvious thousands-
   * separated numbers ("10,000", "1,234,567") into plain digit strings
   * ("10000", "1234567") BEFORE any other parsing happens. This must run
   * first because the exact same comma character is also the separator
   * used by the "Is one of" / "Is not one of" multi-value list syntax —
   * without this normalization, "invoices above 10,000" would be
   * misparsed as a two-item list ["10", "000"].
   */
  function normalizeThousandsSeparators(text) {
    return String(text || '').replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, function (m) { return m.replace(/,/g, ''); });
  }

  var CATEGORICAL_NAME_MARKERS = ['group', 'category', 'type', 'class', 'department', 'team', 'organization', 'organisation'];
  /**
   * scoreColumnAgainstPhrase(col, phraseNormalized) — a general-purpose
   * fuzzy scorer used everywhere a user's wording needs to be mapped onto
   * a schema column even when it does NOT literally contain the column's
   * name/alias (requirement: "identify the appropriate column based on
   * the schema's: Column name, Description, Alias, Decode information").
   * Exact/substring matches on name or alias score highest; word-overlap
   * against name, alias, AND description contributes proportionally
   * smaller, additive scores, so a column whose DESCRIPTION happens to
   * contain the user's words can still be discovered.
   */
  function scoreColumnAgainstPhrase(col, phraseNormalized) {
    if (!phraseNormalized) return 0;
    var score = 0;
    var namePhrase = normalizeSpaces(col.name);
    var aliasPhrase = col.alias ? normalizeSpaces(col.alias) : '';
    var descPhrase = col.description ? normalizeSpaces(col.description) : '';
    if (namePhrase && phraseNormalized === namePhrase) score += 12;
    else if (namePhrase && (phraseNormalized.indexOf(namePhrase) !== -1 || namePhrase.indexOf(phraseNormalized) !== -1)) score += 7;
    if (aliasPhrase && phraseNormalized === aliasPhrase) score += 11;
    else if (aliasPhrase && (phraseNormalized.indexOf(aliasPhrase) !== -1 || aliasPhrase.indexOf(phraseNormalized) !== -1)) score += 6;
    var phraseWords = normalizeWordSet(tokenize(phraseNormalized));
    var nameWords = normalizeWordSet(tokenize(namePhrase));
    var aliasWords = aliasPhrase ? normalizeWordSet(tokenize(aliasPhrase)) : [];
    var descWords = descPhrase ? normalizeWordSet(tokenize(descPhrase).filter(function (w) { return w.length > 2 && !STOPWORDS[w]; })) : [];
    var nameOverlap = phraseWords.filter(function (w) { return nameWords.indexOf(w) !== -1; }).length;
    var aliasOverlap = phraseWords.filter(function (w) { return aliasWords.indexOf(w) !== -1; }).length;
    var descOverlap = phraseWords.filter(function (w) { return descWords.indexOf(w) !== -1; }).length;
    score += nameOverlap * 3 + aliasOverlap * 2.5 + descOverlap * 1.5;
    /* Penalize a categorical/grouping-style column (its name contains
     * GROUP/CATEGORY/TYPE/CLASS/...) when the target PHRASE itself does
     * NOT mention any such categorical concept. Without this, a column
     * like USER_GROUP_NAME can out-score a genuinely intended person-name
     * column (e.g. FULL_NAME) for a phrase like "user name", purely
     * because "USER_GROUP_NAME" happens to literally contain both the
     * words "user" and "name" (with "group" incidentally wedged between
     * them) — a token-overlap false friend. */
    var isCategoricalColumn = CATEGORICAL_NAME_MARKERS.some(function (w) { return namePhrase.indexOf(w) !== -1; });
    var phraseWantsCategorical = CATEGORICAL_NAME_MARKERS.some(function (w) { return phraseNormalized.indexOf(w) !== -1; });
    if (isCategoricalColumn && !phraseWantsCategorical) score -= 5;
    return score;
  }

  /** findColumnByPhraseScored — like Section 1's findColumnByPhrase, but
   * uses the generalized fuzzy scorer above and searches name+alias+
   * description, returning the single best match above a safety
   * threshold (or null if nothing scores highly enough to be confident). */
  function findColumnByPhraseScored(engine, tableNames, phrase, minScore) {
    minScore = minScore == null ? 3 : minScore;
    var phraseNorm = normalizeSpaces(phrase);
    if (!phraseNorm) return null;
    var best = null, bestScore = 0;
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table) return;
      table.columns.forEach(function (col) {
        var s = scoreColumnAgainstPhrase(col, phraseNorm);
        if (s > bestScore) { bestScore = s; best = { table: tname, column: col.name, score: s }; }
      });
    });
    return (best && bestScore >= minScore) ? best : null;
  }

  /**
   * scoreAllTablesEnhanced — extends Section 1's scoreAllTables with:
   *  (a) singular/plural-tolerant word-overlap between the request text
   *      and the table's bare (module-stripped) name, so a plural,
   *      single-word mention like "users" can match a multi-word bare
   *      name like "user data" (requirement 4 — table identification
   *      without requiring the user to know the exact table name), and
   *  (b) table-description (`notes`) word-overlap scoring.
   * Deliberately does NOT discover tables purely from a column
   * description matching generic request words (e.g. "email address") —
   * that proved too permissive in testing (it could pull in entirely
   * unrelated tables that merely happen to also have an email-ish
   * column), so column-level fuzzy matching is reserved for
   * matchColumnsEnhanced, scoped to tables already identified here. This
   * never LOWERS any table's original score, so anything the old
   * scoreAllTables found is still found; it only adds extra confidence.
   */
  function scoreAllTablesEnhanced(text, engine) {
    var base = scoreAllTables(text, engine);
    var textContentWords = normalizeWordSet(contentTokens(text));
    return base.map(function (entry) {
      var t = entry.table;
      var score = entry.score;
      var bareWords = normalizeWordSet(tokenize(bareTableName(t.name)));
      var nameOverlap = bareWords.filter(function (w) { return textContentWords.indexOf(w) !== -1; }).length;
      if (nameOverlap > 0) score += nameOverlap * 2.2;
      if (t.notes) {
        var notesWords = normalizeWordSet(tokenize(t.notes));
        var notesOverlap = textContentWords.filter(function (w) { return notesWords.indexOf(w) !== -1; }).length;
        if (notesOverlap > 0) score += notesOverlap * 1.2;
      }
      /* Column-ALIAS discovery: a column alias is a short, deliberately
       * curated human-readable name (e.g. "Amount", "Name"), so an exact
       * word-boundary match of an alias anywhere in the request is a
       * strong, low-risk signal this table is relevant — unlike generic
       * description-word overlap (deliberately not used for table
       * discovery; see comment above), a curated alias rarely produces a
       * false positive. This lets phrasing like "gross amount" resolve
       * to IA_INVOICE purely via GROSS_SUM's alias "Amount", even though
       * the word "invoice" itself is never mentioned. */
      t.columns.forEach(function (col) {
        if (!col.alias) return;
        var aliasNorm = normalizeSpaces(col.alias);
        /* Require the alias to be reasonably DISTINCTIVE — either
         * multi-word (e.g. "Invoice Number") or a single word of at
         * least 5 characters — to avoid short, extremely generic
         * single-word aliases like "Name"/"Code"/"Type" (which appear
         * in countless unrelated sentences) from falsely pulling in a
         * table purely because that common English word was used. */
        var distinctive = aliasNorm.indexOf(' ') !== -1 || aliasNorm.length >= 5;
        if (aliasNorm && distinctive && new RegExp('\\b' + escapeRegExp(aliasNorm).replace(/ /g, '\\s+') + '\\b', 'i').test(text)) score += 4;
      });
      return { table: t, score: score };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  /** matchColumnsEnhanced — like Section 1's matchColumns, but also picks
   * up columns whose DESCRIPTION (not just name/alias) strongly overlaps
   * the request text, using the same generalized scorer. */
  function matchColumnsEnhanced(text, engine, tableNames) {
    var base = matchColumns(text, engine, tableNames, {});
    var existingKeys = {};
    base.forEach(function (c) { existingKeys[c.table + '.' + c.column] = true; });
    var textWords = normalizeWordSet(contentTokens(text));
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table) return;
      table.columns.forEach(function (col) {
        var key = tname + '.' + col.name;
        if (existingKeys[key]) return;
        if (!col.description) return;
        var descWords = normalizeWordSet(tokenize(col.description).filter(function (w) { return w.length > 2 && !STOPWORDS[w]; }));
        if (!descWords.length) return;
        var overlap = textWords.filter(function (w) { return descWords.indexOf(w) !== -1; }).length;
        if (overlap >= 3) {
          var entry = { table: tname, column: col.name };
          if (col.alias) entry.alias = col.alias;
          base.push(entry);
          existingKeys[key] = true;
        }
      });
    });
    return base;
  }

  /** matchSortEnhanced — like Section 1's matchSort, but resolves the
   * sort target using the generalized fuzzy column scorer, so phrases
   * like "sort by user name" can resolve to FULL_NAME (via its
   * description) even though "user name" never literally appears as a
   * column name/alias. */
  function matchSortEnhanced(text, engine, tableNames) {
    var textLower = String(text || '').toLowerCase();
    /* Allows optional filler words between "sort"/"order" and "by" (e.g.
     * "sort THE RESULT by user name", "order THEM by date"), unlike
     * Section 1's stricter matchSort which only recognizes "sort by"/
     * "sorted by"/"order by" as one contiguous phrase. */
    var re = /\b(?:sorted|order(?:ed)?|sort)\b(?:[^.;]{0,25}?)\bby\s+([a-z0-9 _]+?)(?=(?:\s*,|\s+and\b|\s+ascending|\s+asc\b|\s+descending|\s+desc\b|\s+newest|\s+oldest|\s+highest|\s+lowest|\s+largest|\s+smallest|[.;]|$))/g;
    var out = []; var m;
    while ((m = re.exec(textLower))) {
      var phrase = normalizeSpaces(m[1]);
      var col = findColumnByPhraseScored(engine, tableNames, phrase, 3);
      if (!col) continue;
      var tail = textLower.slice(m.index, m.index + m[0].length + 24);
      var direction = /descending|desc\b|newest|highest|largest|most recent/.test(tail) ? 'DESC' : 'ASC';
      out.push({ table: col.table, column: col.column, direction: direction });
    }
    return out;
  }

  /**
   * deriveBooleanConcept(colName) — decomposes a boolean-ish column name
   * (IS_ACTIVE, LOGIN_ALLOWED, HAS_ACCESS, ...) into a {concept,
   * qualifier} pair so phrasing like "login is allowed" or "active
   * users" can be matched even though the sentence structure inverts the
   * natural column-name word order. Returns null for columns that don't
   * look boolean-ish by name.
   */
  var BOOL_STATE_WORDS = ['ACTIVE', 'ALLOWED', 'ENABLED', 'APPROVED', 'VALID', 'LOCKED', 'DELETED', 'BLOCKED'];
  function deriveBooleanConcept(colName) {
    var upper = String(colName || '').toUpperCase();
    var prefixStripped = upper.replace(/^(IS_|HAS_)/, '');
    var parts = prefixStripped.split('_').filter(Boolean);
    if (!parts.length) return null;
    var last = parts[parts.length - 1];
    if (BOOL_STATE_WORDS.indexOf(last) !== -1) {
      return { qualifier: last.toLowerCase(), concept: normalizeSpaces(parts.slice(0, parts.length - 1).join(' ')) };
    }
    if (upper !== prefixStripped && parts.length) {
      return { qualifier: normalizeSpaces(last), concept: normalizeSpaces(parts.slice(0, parts.length - 1).join(' ')) };
    }
    return null;
  }
  var BOOL_NEGATIVE_SYNONYMS = { active: 'inactive', allowed: 'disallowed', enabled: 'disabled', approved: 'unapproved', valid: 'invalid', locked: 'unlocked', blocked: 'unblocked' };
  var TRUE_LABEL_WORDS = ['yes', 'true', 'active', 'allowed', 'enabled', 'approved', 'valid', 'y', '1'];
  var FALSE_LABEL_WORDS = ['no', 'false', 'inactive', 'disallowed', 'disabled', 'unapproved', 'invalid', 'n', '0'];
  function resolveBooleanCode(engine, tableName, columnName, wantTrue) {
    var decode = engine.getValueMap(tableName, columnName);
    if (decode && decode.length) {
      var wordSet = wantTrue ? TRUE_LABEL_WORDS : FALSE_LABEL_WORDS;
      for (var i = 0; i < decode.length; i++) { if (wordSet.indexOf(String(decode[i].label).toLowerCase()) !== -1) return decode[i].code; }
    }
    return wantTrue ? '1' : '0';
  }
  /**
   * matchBooleanFlagFilters(text, engine, tableNames) — detects natural
   * boolean-flag phrasing ("login is allowed", "active users", "users
   * who are enabled") against every boolean-ish column across the
   * candidate tables. When exactly one column's qualifier matches with
   * the top score, a concrete filter is emitted. When TWO OR MORE
   * distinct columns tie for the same qualifier word with an equal top
   * score, the engine deliberately refuses to guess and instead reports
   * an ambiguity (requirement 18 — "the engine should not guess when
   * guessing could result in an incorrect query").
   * Returns { filters: [...], ambiguities: [...] }.
   */
  function matchBooleanFlagFilters(text, engine, tableNames) {
    var textLower = String(text || '').toLowerCase();
    var filters = [], ambiguities = [];
    var consideredQualifiers = {};
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table) return;
      table.columns.forEach(function (col) {
        var concept = deriveBooleanConcept(col.name);
        if (!concept) return;
        var qualifier = concept.qualifier;
        if (consideredQualifiers[qualifier]) return; // only resolve each qualifier word once per call
        var posPatterns = [];
        if (concept.concept) posPatterns.push(new RegExp('\\b' + escapeRegExp(concept.concept).replace(/ /g, '\\s+') + '\\s+is\\s+' + escapeRegExp(qualifier) + '\\b', 'i'));
        posPatterns.push(new RegExp('\\b' + escapeRegExp(qualifier) + '\\b', 'i'));
        var negWord = BOOL_NEGATIVE_SYNONYMS[qualifier];
        var negPatterns = [new RegExp('\\bis\\s+not\\s+' + escapeRegExp(qualifier) + '\\b', 'i'), new RegExp('\\bnot\\s+' + escapeRegExp(qualifier) + '\\b', 'i')];
        if (negWord) negPatterns.push(new RegExp('\\b' + escapeRegExp(negWord) + '\\b', 'i'));
        var isNegative = negPatterns.some(function (re) { return re.test(text); });
        var isPositive = !isNegative && posPatterns.some(function (re) { return re.test(text); });
        if (!isPositive && !isNegative) return;
        // Gather every column across candidate tables that shares this exact qualifier (for tie/ambiguity detection).
        var tiedCandidates = [];
        tableNames.forEach(function (tn2) {
          var t2 = engine.getTable(tn2); if (!t2) return;
          t2.columns.forEach(function (c2) {
            var concept2 = deriveBooleanConcept(c2.name);
            if (concept2 && concept2.qualifier === qualifier) tiedCandidates.push({ table: tn2, column: c2.name, concept: concept2.concept });
          });
        });
        consideredQualifiers[qualifier] = true;
        if (tiedCandidates.length > 1) {
          // Prefer a candidate whose concept word actually appears in the text (disambiguates naturally, e.g. "login is allowed").
          var withConceptMatch = tiedCandidates.filter(function (c) { return c.concept && textLower.indexOf(c.concept) !== -1; });
          if (withConceptMatch.length === 1) {
            var chosen = withConceptMatch[0];
            filters.push({ table: chosen.table, column: chosen.column, operator: 'eq', value: resolveBooleanCode(engine, chosen.table, chosen.column, isPositive) });
            return;
          }
          if (withConceptMatch.length === 0) {
            ambiguities.push({ term: qualifier, options: tiedCandidates.map(function (c) { var sc = engine.getColumn(c.table, c.column); return { table: c.table, column: c.column, description: sc ? sc.description : '' }; }) });
            return;
          }
        }
        filters.push({ table: tname, column: col.name, operator: 'eq', value: resolveBooleanCode(engine, tname, col.name, isPositive) });
      });
    });
    return { filters: filters, ambiguities: ambiguities };
  }

  /**
   * matchExclusionFilters(text, engine, tableNames) — detects "exclude /
   * excluding / without / except <descriptor> [users|suppliers|...]"
   * phrasing and resolves the descriptor to a concrete NOT-style filter:
   *   1. If an email-like column exists among the candidate tables, and
   *      the descriptor looks like a brand/domain word, emit a
   *      NOT LIKE '%descriptor%' filter on that column (this matches the
   *      spec's own example: "Exclude Basware users" -> EMAIL NOT LIKE
   *      '%basware%').
   *   2. Otherwise, if the descriptor matches a decode label on some
   *      column (e.g. "Basware Access"), emit a `not_in`/`neq` filter
   *      using that column's code for the matched label.
   *   3. Otherwise, no guess is made (empty result) rather than risking
   *      an incorrect filter.
   */
  function matchExclusionFilters(text, engine, tableNames) {
    var out = [];
    var re = /\b(?:exclude|excluding|without|except|not including)\s+([a-z][a-z0-9 _\-]{1,40}?)\s+(?:users?|suppliers?|records?|invoices?|rows?|entries?|orders?|customers?)\b/ig;
    var m;
    while ((m = re.exec(text))) {
      var descriptor = normalizeSpaces(m[1]);
      if (!descriptor) continue;
      /* Prefer an email-like column on whichever candidate table was
       * ranked FIRST overall (the strongest table match), only falling
       * back to the first email-like column found on ANY candidate table
       * if the top table has none — this keeps the exclusion targeted at
       * the table the request is actually about (e.g. "users") rather
       * than an unrelated table that merely also happens to have an
       * email-ish column. */
      var emailCol = null;
      tableNames.forEach(function (tname) {
        if (emailCol) return;
        var table = engine.getTable(tname); if (!table) return;
        table.columns.forEach(function (col) { if (!emailCol && /email/i.test(col.name)) emailCol = { table: tname, column: col.name }; });
      });
      var decodeMatch = null;
      tableNames.forEach(function (tname) {
        if (decodeMatch) return;
        var table = engine.getTable(tname); if (!table) return;
        table.columns.forEach(function (col) {
          if (decodeMatch || !Array.isArray(col.decode)) return;
          col.decode.forEach(function (pair) { if (!decodeMatch && String(pair.label).toLowerCase().indexOf(descriptor) !== -1) decodeMatch = { table: tname, column: col.name, code: pair.code }; });
        });
      });
      if (emailCol) { out.push({ table: emailCol.table, column: emailCol.column, operator: 'not_contains', value: descriptor }); }
      else if (decodeMatch) { out.push({ table: decodeMatch.table, column: decodeMatch.column, operator: 'neq', value: decodeMatch.code }); }
    }
    return out;
  }

  var CATEGORY_WORDS = ['group', 'organization', 'organisation', 'department', 'team', 'division', 'unit'];
  /**
   * matchMembershipFilters(text, engine, tableNames) — detects "belong(s)
   * to the X <group|organization|department|team>" phrasing (requirement
   * 2's own example: "belong to the Finance organization") and resolves
   * it to a filter on whichever candidate column most plausibly holds a
   * categorical name (its own name/description contains one of the
   * CATEGORY_WORDS, e.g. USER_GROUP_NAME), using the captured proper-
   * noun-like value (e.g. "Finance") as the filter value.
   */
  function matchMembershipFilters(text, engine, tableNames) {
    var out = [];
    var catAlt = CATEGORY_WORDS.join('|');
    var re = new RegExp('\\bbelongs?\\s+to\\s+(?:the\\s+)?([A-Za-z][A-Za-z0-9 ]*?)\\s+(?:' + catAlt + ')\\b', 'ig');
    var m;
    while ((m = re.exec(text))) {
      var value = normalizeSpaces(m[1]);
      if (!value) continue;
      var best = null, bestScore = 0;
      tableNames.forEach(function (tname) {
        var table = engine.getTable(tname); if (!table) return;
        table.columns.forEach(function (col) {
          var nameL = col.name.toLowerCase(), descL = (col.description || '').toLowerCase();
          var isCategorical = CATEGORY_WORDS.some(function (w) { return nameL.indexOf(w) !== -1 || descL.indexOf(w) !== -1; }) && /name/i.test(col.name);
          if (!isCategorical) return;
          var s = 5;
          if (s > bestScore) { bestScore = s; best = { table: tname, column: col.name }; }
        });
      });
      if (best) out.push({ table: best.table, column: best.column, operator: 'eq', value: value.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) });
    }
    return out;
  }

  var MONTH_NAMES = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  /**
   * matchDateRangeFilters(text, engine, tableNames, usedColumns) —
   * detects "between <Month> and <Month> <Year>" phrasing and resolves
   * it to a BETWEEN filter on the most contextually relevant date/
   * timestamp column not already used by another filter. Prefers a
   * column whose name matches a word actually present in the text right
   * before "between" (e.g. "invoices CREATED between ..." prefers a
   * column whose name contains "creat").
   */
  function matchDateRangeFilters(text, engine, tableNames, usedColumns) {
    var m = String(text || '').match(/\bbetween\s+([a-z]+)\s+and\s+([a-z]+)\s+(\d{4})\b/i);
    if (!m) return null;
    var m1 = MONTH_NAMES[m[1].toLowerCase()], m2 = MONTH_NAMES[m[2].toLowerCase()], year = parseInt(m[3], 10);
    if (!m1 || !m2) return null;
    var candidates = [];
    tableNames.forEach(function (tname) {
      var table = engine.getTable(tname); if (!table) return;
      table.columns.forEach(function (col) {
        var key = tname + '.' + col.name;
        if (usedColumns && usedColumns[key]) return;
        var category = DATATYPE ? DATATYPE.classify(col.type) : 'unknown';
        if (category === 'date' || category === 'timestamp') candidates.push({ table: tname, column: col.name, name: col.name });
      });
    });
    if (!candidates.length) return null;
    var beforeBetween = String(text || '').toLowerCase().slice(0, m.index);
    var preferred = candidates.filter(function (c) { var w = c.name.toLowerCase(); return (w.indexOf('creat') !== -1 && beforeBetween.indexOf('creat') !== -1) || (w.indexOf('due') !== -1 && beforeBetween.indexOf('due') !== -1); });
    var chosen = preferred[0] || candidates.filter(function (c) { return /creat/i.test(c.name); })[0] || candidates[0];
    var from = year + '-' + pad2(m1) + '-01';
    var to = year + '-' + pad2(m2) + '-' + pad2(daysInMonth(year, m2));
    return { table: chosen.table, column: chosen.column, operator: 'between', value: from, value2: to };
  }

  /**
   * matchDecodeRequests(text, engine, tableNames) — detects "show the X
   * as its description/label/name/text (instead of the numeric value)"
   * phrasing, resolving X to a schema column via the fuzzy scorer, and
   * marking it for Decode (CASE expression) rendering.
   */
  function matchDecodeRequests(text, engine, tableNames) {
    var out = [];
    var re = /\bshow\s+(?:the\s+|all\s+)?([a-z0-9 _]+?)\s+as\s+(?:its\s+|the\s+)?(?:description|label|name|text)\b/ig;
    var m;
    while ((m = re.exec(text))) {
      var phrase = normalizeSpaces(m[1]);
      var best = findColumnByPhraseScored(engine, tableNames, phrase, 4);
      if (best) out.push({ table: best.table, column: best.column });
    }
    return out;
  }

  var AGG_PATTERNS = [
    { fn: 'COUNT', re: /\b(?:count of|how many|number of)\s*([a-z0-9 _]*)/i },
    { fn: 'SUM', re: /\b(?:sum of|total)\s+([a-z0-9 _]+)/i },
    { fn: 'AVG', re: /\b(?:average|avg)\s+(?:of\s+)?([a-z0-9 _]+)/i },
    { fn: 'MIN', re: /\b(?:minimum|lowest|smallest)\s+([a-z0-9 _]+)/i },
    { fn: 'MAX', re: /\b(?:maximum|highest|largest)\s+([a-z0-9 _]+)/i }
  ];
  /**
   * matchAggregations(text, engine, tableNames) — detects aggregation
   * phrasing ("count of", "how many", "total X", "average X", "lowest
   * X", "highest X") and resolves the target column via the fuzzy
   * scorer. A bare "how many <table concept>" with no specific column
   * (or where nothing scores highly enough) yields a COUNT(*) instead of
   * guessing a column.
   */
  function matchAggregations(text, engine, tableNames) {
    var results = [];
    AGG_PATTERNS.forEach(function (p) {
      var m = text.match(p.re);
      if (!m) return;
      var phrase = normalizeSpaces(m[1] || '');
      if (p.fn === 'COUNT' && (!phrase || !findColumnByPhraseScored(engine, tableNames, phrase, 5))) {
        results.push({ aggregate: 'COUNT', table: tableNames[0], column: '*', alias: 'record_count' });
        return;
      }
      var best = findColumnByPhraseScored(engine, tableNames, phrase, 4);
      if (best) results.push({ aggregate: p.fn, table: best.table, column: best.column, alias: (p.fn.toLowerCase() + '_' + best.column.toLowerCase()) });
    });
    return results;
  }
  /** matchGroupBy(text, engine, tableNames) — detects "group(ed) by X". */
  function matchGroupBy(text, engine, tableNames) {
    var re = /\bgroup(?:ed)?\s+by\s+([a-z0-9 _]+?)(?=(?:\s*,|\s+and\b|[.;]|$))/ig;
    var out = []; var m;
    while ((m = re.exec(text))) {
      var phrase = normalizeSpaces(m[1]);
      var best = findColumnByPhraseScored(engine, tableNames, phrase, 3);
      if (best) out.push({ table: best.table, column: best.column });
    }
    return out;
  }
  var HAVING_FN_MAP = { count: 'COUNT', sum: 'SUM', average: 'AVG', avg: 'AVG', total: 'SUM', minimum: 'MIN', maximum: 'MAX' };
  var HAVING_OP_MAP = { 'more than': '>', 'greater than': '>', 'at least': '>=', 'less than': '<', 'at most': '<=', 'equal to': '=', '=': '=' };
  /** matchHaving(text, engine, tableNames, aggregates) — detects simple
   * "having <fn> [of X] <comparison> <number>" phrasing and, if it
   * matches an already-detected aggregate by function, reuses that
   * aggregate's exact expression; otherwise falls back to COUNT(*). */
  function matchHaving(text, aggregates) {
    var m = String(text || '').match(/\bhaving\s+(count|sum|average|avg|total|minimum|maximum)\b(?:\s+of\s+[a-z0-9 _]+)?\s*(more than|greater than|at least|less than|at most|equal to|=)\s+([\d.]+)/i);
    if (!m) return null;
    var fn = HAVING_FN_MAP[m[1].toLowerCase()];
    var op = HAVING_OP_MAP[m[2].toLowerCase()];
    var val = m[3];
    if (!fn || !op) return null;
    var matchedAgg = (aggregates || []).filter(function (a) { return a.aggregate === fn; })[0];
    var expr = matchedAgg ? (fn + '(' + (matchedAgg.column === '*' ? '*' : (matchedAgg.table + '.' + matchedAgg.column)) + ')') : (fn + '(*)');
    return expr + ' ' + op + ' ' + val;
  }

  /**
   * buildAdjacency(engine) — builds a bidirectional table-relationship
   * graph directly from each table's own foreign_key columns: O(total
   * columns in the schema), never O(tables^2), so it stays fast even
   * with up to ~1000 tables (requirement 27 — performance).
   */
  function buildAdjacency(engine) {
    var tables = engine.getAllTables();
    var adj = {};
    tables.forEach(function (t) { adj[t.name.toUpperCase()] = adj[t.name.toUpperCase()] || {}; });
    tables.forEach(function (t) {
      t.columns.forEach(function (c) {
        if (c.foreign_key && c.foreign_key.table) {
          var a = t.name.toUpperCase(), b = String(c.foreign_key.table).toUpperCase();
          adj[a] = adj[a] || {}; adj[b] = adj[b] || {};
          adj[a][b] = true; adj[b][a] = true;
        }
      });
    });
    return adj;
  }
  function shortestPath(adj, start, goal) {
    if (start === goal) return [start];
    if (!adj[start]) return null;
    var visited = {}; visited[start] = true;
    var queue = [[start]];
    while (queue.length) {
      var path = queue.shift();
      var node = path[path.length - 1];
      var neighbors = Object.keys(adj[node] || {});
      for (var i = 0; i < neighbors.length; i++) {
        var nb = neighbors[i];
        if (nb === goal) return path.concat([nb]);
        if (!visited[nb]) { visited[nb] = true; queue.push(path.concat([nb])); }
      }
    }
    return null;
  }
  /**
   * resolveJoinClosure(engine, requiredTableNames) — requirement 6,
   * "Automatic Relationship and JOIN Detection": given the set of tables
   * the request genuinely needs (e.g. ADM_USER_DATA + ADM_USER_GROUP,
   * mentioned by name/column but with NO direct foreign key between
   * them), finds the shortest connecting path through the FULL schema
   * graph and silently folds in any necessary bridge/junction tables
   * (e.g. ADM_USER_GROUP_MEMBER) so the later join-building step
   * (sql-engine's buildJoinPlan) can always succeed with a normal
   * consecutive-table INNER/LEFT JOIN chain. Returns the final ordered
   * table list, which bridge tables were added, and any table that still
   * could not be connected at all (schema genuinely has no path).
   */
  function resolveJoinClosure(engine, requiredTableNames) {
    var required = requiredTableNames.map(function (t) { return String(t).toUpperCase(); });
    if (required.length <= 1) return { tables: requiredTableNames.slice(), bridgeTables: [], unresolved: [] };
    var adj = buildAdjacency(engine);
    var finalSet = {}; required.forEach(function (t) { finalSet[t] = true; });
    var bridgeTablesUpper = [];
    var connected = [required[0]];
    var remaining = required.slice(1);
    var guard = 0;
    while (remaining.length && guard < 100) {
      guard++;
      var progressed = false;
      for (var i = 0; i < remaining.length; i++) {
        var target = remaining[i];
        var bestPath = null;
        for (var j = 0; j < connected.length; j++) {
          var p = shortestPath(adj, connected[j], target);
          if (p && (!bestPath || p.length < bestPath.length)) bestPath = p;
        }
        if (bestPath) {
          bestPath.forEach(function (node) { if (!finalSet[node]) { finalSet[node] = true; bridgeTablesUpper.push(node); } if (connected.indexOf(node) === -1) connected.push(node); });
          remaining.splice(i, 1); i--; progressed = true;
        }
      }
      if (!progressed) break;
    }
    var unresolvedUpper = remaining.slice();
    var orderedTables = []; var seen = {};
    requiredTableNames.forEach(function (t) { var u = String(t).toUpperCase(); var tbl = engine.getTable(u); if (tbl && finalSet[u] && !seen[u]) { orderedTables.push(tbl.name); seen[u] = true; } });
    bridgeTablesUpper.forEach(function (u) { if (!seen[u]) { var tbl = engine.getTable(u); if (tbl) { orderedTables.push(tbl.name); seen[u] = true; } } });
    var bridgeTables = bridgeTablesUpper.map(function (u) { var tbl = engine.getTable(u); return tbl ? tbl.name : u; });
    var unresolved = unresolvedUpper.map(function (u) { var tbl = engine.getTable(u); return tbl ? tbl.name : u; });
    return { tables: orderedTables, bridgeTables: bridgeTables, unresolved: unresolved };
  }

  var AMBIGUOUS_TRIGGER_WORDS = ['active', 'enabled', 'valid', 'approved', 'current', 'open'];
  /**
   * findAmbiguousTerms(text, engine, tableNames, resolvedFilters) — a
   * secondary safety net (beyond matchBooleanFlagFilters' own tie
   * detection) for generic adjectives that could plausibly refer to more
   * than one schema column. Columns already resolved into a concrete
   * filter (e.g. by matchBooleanFlagFilters) are excluded, since they
   * were deterministically resolved, not guessed.
   */
  function findAmbiguousTerms(text, engine, tableNames, resolvedFilters) {
    var textLower = String(text || '').toLowerCase();
    var resolvedKeys = {};
    (resolvedFilters || []).forEach(function (f) { resolvedKeys[f.table + '.' + f.column] = true; });
    var ambiguities = [];
    AMBIGUOUS_TRIGGER_WORDS.forEach(function (word) {
      if (textLower.indexOf(word) === -1) return;
      var candidates = [];
      tableNames.forEach(function (tname) {
        var table = engine.getTable(tname); if (!table) return;
        table.columns.forEach(function (col) {
          var key = tname + '.' + col.name;
          if (resolvedKeys[key]) return;
          var nameL = col.name.toLowerCase(), descL = (col.description || '').toLowerCase();
          if (nameL.indexOf(word) !== -1 || descL.indexOf(word) !== -1) candidates.push({ table: tname, column: col.name, description: col.description || '' });
        });
      });
      if (candidates.length >= 2) ambiguities.push({ term: word, options: candidates });
    });
    return ambiguities;
  }

  /** computeConfidence — a simple, transparent summary used to render the
   * "✓ Table identified / ✓ Columns identified / ..." checklist. */
  function computeConfidence(finalTables, finalColumns, unresolvedJoins, ambiguities) {
    return {
      tableIdentified: finalTables.length > 0,
      columnsIdentified: finalTables.length > 0,
      relationshipsIdentified: (unresolvedJoins || []).length === 0,
      hasAmbiguities: (ambiguities || []).length > 0,
      unresolvedJoins: unresolvedJoins || [],
      sqlValidated: false /* set true by the caller once sql-engine actually returns status 'ok' */
    };
  }

  function buildMatchedSummary(tables, columns, filters, orderBy, groupBy, aggregates, limit, distinct, bridgeTables) {
    var matched = [];
    tables.forEach(function (t) { matched.push('Table: ' + t + (bridgeTables && bridgeTables.indexOf(t) !== -1 ? ' (connected automatically)' : '')); });
    columns.forEach(function (c) { matched.push('Column: ' + c.table + '.' + c.column + (c.alias ? (' (as ' + c.alias + ')') : '') + (c.decode ? ' (decoded)' : '')); });
    filters.forEach(function (c) { matched.push('Filter: ' + c.table + '.' + c.column + ' ' + describeOperatorForDisplay(c)); });
    (aggregates || []).forEach(function (a) { matched.push('Aggregate: ' + a.aggregate + '(' + (a.column === '*' ? '*' : (a.table + '.' + a.column)) + ')'); });
    (groupBy || []).forEach(function (g) { matched.push('Grouped by: ' + g.table + '.' + g.column); });
    orderBy.forEach(function (o) { matched.push('Sort: ' + o.table + '.' + o.column + ' (' + (o.direction === 'DESC' ? 'largest/latest first' : 'smallest/earliest first') + ')'); });
    if (limit) matched.push('Limit: ' + limit);
    if (distinct) matched.push('Remove duplicates: yes');
    return matched;
  }

  /**
   * explainInterpretation(interpretation) — converts a resolved
   * interpretation into a short list of plain-English sentences
   * describing what the query does (requirement 24 — "Explain Complex
   * SQL"), free of SQL jargon where possible.
   */
  function explainInterpretation(interpretation) {
    var lines = [];
    if (!interpretation || !interpretation.tables || !interpretation.tables.length) return lines;
    if (interpretation.tables.length === 1) lines.push('Retrieves data from ' + interpretation.tables[0] + '.');
    else lines.push('Retrieves data from ' + interpretation.tables[0] + ', joined with ' + interpretation.tables.slice(1).join(', ') + '.');
    (interpretation.filterConditions || []).forEach(function (f) { lines.push('Filters where ' + f.table + '.' + f.column + ' ' + describeOperatorForDisplay(f) + '.'); });
    if (interpretation.groupBy && interpretation.groupBy.length) lines.push('Groups the results by ' + interpretation.groupBy.map(function (g) { return g.table + '.' + g.column; }).join(', ') + '.');
    (interpretation.aggregates || []).forEach(function (a) { lines.push('Calculates the ' + a.aggregate + ' of ' + (a.column === '*' ? 'matching records' : (a.table + '.' + a.column)) + '.'); });
    if (interpretation.having) lines.push('Only keeps groups where ' + interpretation.having + '.');
    if (interpretation.orderBy && interpretation.orderBy.length) lines.push('Sorts the results by ' + interpretation.orderBy.map(function (o) { return o.table + '.' + o.column + ' (' + (o.direction === 'DESC' ? 'highest first' : 'lowest first') + ')'; }).join(', ') + '.');
    if (interpretation.distinct) lines.push('Removes duplicate rows from the result.');
    if (interpretation.limit) lines.push('Limits the result to the first ' + interpretation.limit + ' rows.');
    return lines;
  }

  function dedupeFilterConditions(conditions) {
    var seen = {}; var out = [];
    conditions.forEach(function (c) {
      if (!c) return;
      var key = [c.table, c.column, c.operator, c.value, c.value2].map(function (x) { return String(x == null ? '' : x).toUpperCase(); }).join('|');
      if (seen[key]) return; seen[key] = true; out.push(c);
    });
    return out;
  }
  function emptyRichInterpretation(warnings) {
    return {
      tables: [], columns: [], filterConditions: [], orderBy: [], limit: null, distinct: false, hierarchyTable: null,
      aggregates: [], groupBy: [], having: null, bridgeTables: [], unresolvedJoins: [], ambiguities: [],
      confidence: computeConfidence([], [], [], []), matched: [], warnings: warnings || []
    };
  }

  /**
   * interpretRequirement(text, engine, opts) — THE master V10.6 pipeline
   * for the Read Only Query Builder's "Describe What You Need" box.
   * Implements the full chain described in the spec:
   *   NLU -> Schema Analysis -> Table ID -> Column ID -> Relationship/
   *   JOIN ID -> Filter ID (incl. booleans/exclusions/date-ranges) ->
   *   Aggregation/GROUP BY/HAVING -> confidence/ambiguity reporting.
   * Never invents tables/columns that don't exist in the active schema —
   * every table/column referenced in the return value was found via
   * `engine.getTable`/`engine.getColumn`, which only ever return real
   * schema objects.
   */
  function interpretRequirement(text, engine, opts) {
    opts = opts || {};
    var now = opts.now || new Date();
    var normalizedText = normalizeThousandsSeparators(String(text || ''));
    if (!normalizedText.trim()) return emptyRichInterpretation();

    var preliminaryRanked = scoreAllTablesEnhanced(normalizedText, engine).filter(function (s) { return s.score >= 1; });
    var preliminaryNames = preliminaryRanked.map(function (s) { return s.table.name; });
    var hierarchyTable = matchHierarchy(normalizedText, engine, preliminaryNames);
    if (hierarchyTable) {
      var hInterp = emptyRichInterpretation();
      hInterp.tables = [hierarchyTable]; hInterp.hierarchyTable = hierarchyTable; hInterp.matched = ['Hierarchy: ' + hierarchyTable];
      hInterp.confidence = computeConfidence([hierarchyTable], [], [], []);
      return hInterp;
    }

    var ranked = preliminaryRanked;
    var candidateNames = preliminaryNames;
    if (!ranked.length) return emptyRichInterpretation(['Could not identify any tables mentioned in your description. Try naming a specific concept from your data (e.g. "invoices", "suppliers", "users"), or select tables manually below.']);

    var columns = matchColumnsEnhanced(normalizedText, engine, candidateNames);
    var decodeRequestCols = matchDecodeRequests(normalizedText, engine, candidateNames);
    decodeRequestCols.forEach(function (d) {
      var existing = columns.filter(function (c) { return c.table === d.table && c.column === d.column; })[0];
      if (existing) existing.decode = true; else columns.push({ table: d.table, column: d.column, decode: true });
    });

    var usedCols = {};
    var boolResult = matchBooleanFlagFilters(normalizedText, engine, candidateNames);
    boolResult.filters.forEach(function (f) { usedCols[f.table + '.' + f.column] = true; });
    var opFilters = matchFilters(normalizedText, engine, candidateNames, now);
    var exclusionFilters = matchExclusionFilters(normalizedText, engine, candidateNames);
    var membershipFilters = matchMembershipFilters(normalizedText, engine, candidateNames);
    var dateRangeFilter = matchDateRangeFilters(normalizedText, engine, candidateNames, usedCols);
    var filterConditions = dedupeFilterConditions(boolResult.filters.concat(opFilters).concat(exclusionFilters).concat(membershipFilters).concat(dateRangeFilter ? [dateRangeFilter] : []));

    var orderBy = matchSortEnhanced(normalizedText, engine, candidateNames);
    var limit = matchLimit(normalizedText);
    var distinct = matchDistinct(normalizedText);

    var aggregates = matchAggregations(normalizedText, engine, candidateNames);
    var groupBy = matchGroupBy(normalizedText, engine, candidateNames);
    var having = matchHaving(normalizedText, aggregates);
    if (aggregates.length && !groupBy.length && columns.length) {
      groupBy = columns.filter(function (c) { return !c.decode; }).map(function (c) { return { table: c.table, column: c.column }; });
    }

    var tablesWithPurpose = {};
    columns.forEach(function (c) { tablesWithPurpose[c.table] = true; });
    filterConditions.forEach(function (c) { tablesWithPurpose[c.table] = true; });
    orderBy.forEach(function (o) { tablesWithPurpose[o.table] = true; });
    groupBy.forEach(function (g) { tablesWithPurpose[g.table] = true; });
    aggregates.forEach(function (a) { if (a.column !== '*') tablesWithPurpose[a.table] = true; });
    tablesWithPurpose[ranked[0].table.name] = true;
    var requiredTables = candidateNames.filter(function (t) { return tablesWithPurpose[t]; });
    if (aggregates.some(function (a) { return a.column === '*'; }) && requiredTables.indexOf(ranked[0].table.name) === -1) requiredTables.push(ranked[0].table.name);

    var closure = resolveJoinClosure(engine, requiredTables);
    var finalTables = closure.tables;

    var ambiguities = boolResult.ambiguities.concat(findAmbiguousTerms(normalizedText, engine, finalTables, filterConditions));

    var finalColumns = columns.filter(function (c) { return finalTables.indexOf(c.table) !== -1; });
    var finalFilters = filterConditions.filter(function (c) { return finalTables.indexOf(c.table) !== -1; });
    var finalOrderBy = orderBy.filter(function (o) { return finalTables.indexOf(o.table) !== -1; });
    var finalGroupBy = groupBy.filter(function (g) { return finalTables.indexOf(g.table) !== -1; });
    var finalAggregates = aggregates.filter(function (a) { return a.column === '*' || finalTables.indexOf(a.table) !== -1; });

    var matched = buildMatchedSummary(finalTables, finalColumns, finalFilters, finalOrderBy, finalGroupBy, finalAggregates, limit, distinct, closure.bridgeTables);
    var confidence = computeConfidence(finalTables, finalColumns, closure.unresolved, ambiguities);
    var warnings = [];
    if (closure.unresolved.length) warnings.push('Could not automatically connect: ' + closure.unresolved.join(', ') + '. You can connect these manually in Advanced Options.');
    ambiguities.forEach(function (a) { warnings.push('"' + a.term + '" could refer to more than one column \u2014 please clarify below.'); });

    return {
      tables: finalTables, columns: finalColumns, filterConditions: finalFilters, orderBy: finalOrderBy,
      limit: limit, distinct: distinct, hierarchyTable: null,
      aggregates: finalAggregates, groupBy: finalGroupBy, having: having,
      bridgeTables: closure.bridgeTables, unresolvedJoins: closure.unresolved,
      ambiguities: ambiguities, confidence: confidence, matched: matched, warnings: warnings
    };
  }

  /**
   * interpretCrRequirement(text, engine, opts) — the V10.6 counterpart for
   * the Query Builder for CR's Describe box. Applies the same thousands-
   * separator normalization and generalized column scoring improvements
   * as interpretRequirement, while preserving the existing CR semantics
   * (single target table, INSERT/UPDATE/DELETE detection, WHERE-clause
   * segmentation) — CR statements never aggregate/group/join by design.
   */
  function interpretCrRequirement(text, engine, opts) {
    opts = opts || {};
    var normalizedText = normalizeThousandsSeparators(String(text || ''));
    var base = interpretCrDescription(normalizedText, engine, opts);
    if (base.table && (base.command === 'UPDATE' || base.command === 'DELETE')) {
      var whereMatch = normalizedText.match(/\bwhere\b/i);
      var filterText = whereMatch ? normalizedText.slice(whereMatch.index) : normalizedText;
      var extra = matchExclusionFilters(filterText, engine, [base.table]);
      if (extra.length) {
        base.filterConditions = dedupeFilterConditions(base.filterConditions.concat(extra));
        extra.forEach(function (c) { base.matched.push('Filter: ' + c.table + '.' + c.column + ' ' + describeOperatorForDisplay(c)); });
      }
    }
    return base;
  }

  function mergeAggregates(existing, incoming) {
    var seen = {}; (existing || []).forEach(function (a) { seen[a.aggregate + '|' + a.table + '|' + a.column] = true; });
    var out = (existing || []).slice();
    (incoming || []).forEach(function (a) { var k = a.aggregate + '|' + a.table + '|' + a.column; if (!seen[k]) { seen[k] = true; out.push(a); } });
    return out;
  }
  function mergeGroupBy(existing, incoming) {
    var seen = {}; (existing || []).forEach(function (g) { seen[g.table + '|' + g.column] = true; });
    var out = (existing || []).slice();
    (incoming || []).forEach(function (g) { var k = g.table + '|' + g.column; if (!seen[k]) { seen[k] = true; out.push(g); } });
    return out;
  }

  var API = {
    /* Section 1 — unchanged, fully backward-compatible V10.1–V10.5 API */
    interpretDescription: interpretDescription,
    interpretCrDescription: interpretCrDescription,
    mergeTableLists: mergeTableLists,
    mergeColumnLists: mergeColumnLists,
    mergeFilterConditions: mergeFilterConditions,
    scoreAllTables: scoreAllTables, matchColumns: matchColumns, matchFilters: matchFilters,
    matchSort: matchSort, matchLimit: matchLimit, matchDistinct: matchDistinct, matchHierarchy: matchHierarchy,
    detectCrCommand: detectCrCommand, matchColumnValueAssignments: matchColumnValueAssignments,
    bareTableName: bareTableName, normalizeSpaces: normalizeSpaces,
    /* Section 2 — new V10.6 intelligent engine */
    normalizeThousandsSeparators: normalizeThousandsSeparators,
    scoreColumnAgainstPhrase: scoreColumnAgainstPhrase,
    findColumnByPhraseScored: findColumnByPhraseScored,
    scoreAllTablesEnhanced: scoreAllTablesEnhanced,
    matchColumnsEnhanced: matchColumnsEnhanced,
    matchSortEnhanced: matchSortEnhanced,
    deriveBooleanConcept: deriveBooleanConcept,
    matchBooleanFlagFilters: matchBooleanFlagFilters,
    matchExclusionFilters: matchExclusionFilters,
    matchMembershipFilters: matchMembershipFilters,
    matchDateRangeFilters: matchDateRangeFilters,
    matchDecodeRequests: matchDecodeRequests,
    matchAggregations: matchAggregations,
    matchGroupBy: matchGroupBy,
    matchHaving: matchHaving,
    buildAdjacency: buildAdjacency,
    shortestPath: shortestPath,
    resolveJoinClosure: resolveJoinClosure,
    findAmbiguousTerms: findAmbiguousTerms,
    computeConfidence: computeConfidence,
    explainInterpretation: explainInterpretation,
    interpretRequirement: interpretRequirement,
    interpretCrRequirement: interpretCrRequirement,
    mergeAggregates: mergeAggregates,
    mergeGroupBy: mergeGroupBy,
    dedupeFilterConditions: dedupeFilterConditions
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.APSQL_NLQUERY = API;
})(typeof window !== 'undefined' ? window : this);
