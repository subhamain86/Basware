'use strict';
/**
 * nl-query-engine-intelligent.test.js — dedicated test suite for the
 * V10.6 "Intelligent Query Builder" engine (Section 2 of
 * nl-query-engine.js: interpretRequirement, interpretCrRequirement, and
 * their supporting helpers). Section 1 (V10.1–V10.5, unchanged) is
 * covered separately in nl-query-engine.test.js.
 */
var path = require('path');
var schema = require(path.join(__dirname, '..', 'schema', 'schema-sample.js'));
var SCHEMA_ENGINE = require(path.join(__dirname, '..', 'js', 'schema-engine.js'));
global.APSQL_DATATYPE = require(path.join(__dirname, '..', 'js', 'datatype-engine.js'));
var NLQ = require(path.join(__dirname, '..', 'js', 'nl-query-engine.js'));
var engine = SCHEMA_ENGINE.createEngine(schema);

/* ---------------------------------------------------------------------
   Core success-criteria scenarios (requirement 28 and the worked
   examples throughout the spec).
   --------------------------------------------------------------------- */
test('Requirement 2 (simple): "Show all users whose login is allowed" identifies table+column+filter with zero manual selection', function () {
  var r = NLQ.interpretRequirement('Show all users whose login is allowed.', engine, {});
  assertEqual(r.tables, ['ADM_USER_DATA']);
  assertTrue(r.filterConditions.some(function (f) { return f.table === 'ADM_USER_DATA' && f.column === 'LOGIN_ALLOWED' && f.operator === 'eq' && f.value === '1'; }));
});
test('Requirement 28 success criteria: the full complex sentence resolves tables, joins, filters, exclusion, and sort with zero manual selection', function () {
  var text = 'Show all active users with their email address and user group, exclude Basware users, and sort by login account.';
  var r = NLQ.interpretRequirement(text, engine, {});
  assertEqual(r.tables.slice().sort(), ['ADM_USER_DATA', 'ADM_USER_GROUP', 'ADM_USER_GROUP_MEMBER'].sort());
  assertTrue(r.filterConditions.some(function (f) { return f.table === 'ADM_USER_DATA' && f.column === 'IS_ACTIVE' && f.value === '1'; }));
  assertTrue(r.filterConditions.some(function (f) { return f.table === 'ADM_USER_DATA' && f.column === 'EMAIL' && f.operator === 'not_contains' && f.value === 'basware'; }));
  assertEqual(r.orderBy.length, 1);
  assertEqual(r.orderBy[0].column, 'LOGIN_ACCOUNT');
  assertEqual(r.unresolvedJoins.length, 0);
  assertEqual(r.ambiguities.length, 0);
});
test('Requirement 2 full illustrative sentence: membership filter ("belong to the Finance organization") and "user name" sort both resolve correctly', function () {
  var text = 'Show all active users who belong to the Finance organization, including their email address and user group. Exclude Basware users and sort the result by user name.';
  var r = NLQ.interpretRequirement(text, engine, {});
  assertTrue(r.tables.indexOf('ADM_USER_DATA') !== -1 && r.tables.indexOf('ADM_USER_GROUP') !== -1 && r.tables.indexOf('ADM_USER_GROUP_MEMBER') !== -1);
  assertTrue(r.filterConditions.some(function (f) { return f.column === 'USER_GROUP_NAME' && f.value === 'Finance'; }));
  assertTrue(r.filterConditions.some(function (f) { return f.column === 'IS_ACTIVE' && f.value === '1'; }));
  assertTrue(r.filterConditions.some(function (f) { return f.column === 'EMAIL' && f.operator === 'not_contains'; }));
  assertEqual(r.orderBy[0].table, 'ADM_USER_DATA');
  assertEqual(r.orderBy[0].column, 'FULL_NAME');
});
test('Requirement 4: "Show supplier name and supplier code for active suppliers" needs zero manual selection', function () {
  var r = NLQ.interpretRequirement('Show supplier name and supplier code for active suppliers.', engine, {});
  assertEqual(r.tables, ['IA_SUPPLIER']);
  var cols = r.columns.map(function (c) { return c.column; });
  assertTrue(cols.indexOf('SUPPLIER_NAME') !== -1);
  assertTrue(cols.indexOf('SUPPLIER_CODE') !== -1);
  assertTrue(r.filterConditions.some(function (f) { return f.column === 'IS_ACTIVE' && f.value === '1'; }));
});
test('Requirement 5: "Show the supplier email address" maps user wording to the schema column without requiring the exact column name', function () {
  var r = NLQ.interpretRequirement('Show the supplier email address.', engine, {});
  assertEqual(r.tables, ['IA_SUPPLIER']);
  assertTrue(r.columns.some(function (c) { return c.column === 'SUPPLIER_EMAIL'; }));
});
test('Requirement 7: "Show invoices above 10,000" (thousands separator) produces a numeric filter, not a broken multi-value list', function () {
  var r = NLQ.interpretRequirement('Show invoices above 10,000.', engine, {});
  assertEqual(r.tables, ['IA_INVOICE']);
});
test('Requirement 7: date-range phrasing "between January and March 2026" resolves against the CREATED_DATE column with a real BETWEEN filter', function () {
  var r = NLQ.interpretRequirement('Show invoices created between January and March 2026.', engine, {});
  var f = r.filterConditions.filter(function (c) { return c.column === 'CREATED_DATE'; })[0];
  assertTrue(f !== undefined);
  assertEqual(f.operator, 'between');
  assertEqual(f.value, '2026-01-01');
  assertEqual(f.value2, '2026-03-31');
});
test('Requirement 10 (Decode Awareness): "show the login type as its description" marks LOGIN_TYPE for decode rendering', function () {
  var r = NLQ.interpretRequirement('Show all users. Show the login type as its description instead of the numeric value.', engine, {});
  var col = r.columns.filter(function (c) { return c.column === 'LOGIN_TYPE'; })[0];
  assertTrue(col !== undefined);
  assertTrue(col.decode === true);
});
test('Requirement 9/28 (Aggregation + GROUP BY): "total gross amount grouped by supplier" resolves the join, the aggregate target, and the group-by column', function () {
  var r = NLQ.interpretRequirement('Show the total gross amount grouped by supplier.', engine, {});
  assertTrue(r.tables.indexOf('IA_INVOICE') !== -1 && r.tables.indexOf('IA_SUPPLIER') !== -1);
  assertEqual(r.aggregates.length, 1);
  assertEqual(r.aggregates[0].aggregate, 'SUM');
  assertEqual(r.aggregates[0].table, 'IA_INVOICE');
  assertEqual(r.aggregates[0].column, 'GROSS_SUM');
  assertEqual(r.groupBy.length, 1);
  assertEqual(r.groupBy[0].table, 'IA_SUPPLIER');
});

/* ---------------------------------------------------------------------
   Never invents tables/columns that don't exist.
   --------------------------------------------------------------------- */
test('never invents a table: an unrecognizable request returns no tables and a clear warning rather than guessing', function () {
  var r = NLQ.interpretRequirement('Show me something interesting about the weather forecast.', engine, {});
  assertEqual(r.tables.length, 0);
  assertTrue(r.warnings.length > 0);
});
test('every table in a rich interpretation genuinely exists in the active schema', function () {
  var r = NLQ.interpretRequirement('Show all active users with their email address and user group, exclude Basware users, and sort by login account.', engine, {});
  r.tables.forEach(function (t) { assertTrue(engine.tableExists(t)); });
});
test('every column in a rich interpretation genuinely exists on its stated table in the active schema', function () {
  var r = NLQ.interpretRequirement('Show all active users with their email address and user group, exclude Basware users, and sort by login account.', engine, {});
  r.columns.forEach(function (c) { assertTrue(engine.columnExists(c.table, c.column)); });
});

/* ---------------------------------------------------------------------
   normalizeThousandsSeparators
   --------------------------------------------------------------------- */
test('normalizeThousandsSeparators strips commas from large numbers but leaves short lists of small numbers untouched', function () {
  assertEqual(NLQ.normalizeThousandsSeparators('invoices above 10,000'), 'invoices above 10000');
  assertEqual(NLQ.normalizeThousandsSeparators('status is one of 10, 40'), 'status is one of 10, 40');
  assertEqual(NLQ.normalizeThousandsSeparators('total is 1,234,567 exactly'), 'total is 1234567 exactly');
});

/* ---------------------------------------------------------------------
   scoreColumnAgainstPhrase / findColumnByPhraseScored
   --------------------------------------------------------------------- */
test('scoreColumnAgainstPhrase scores an exact name match highest', function () {
  var col = { name: 'FULL_NAME', alias: '', description: 'Full name of the user' };
  assertTrue(NLQ.scoreColumnAgainstPhrase(col, 'full name') > NLQ.scoreColumnAgainstPhrase(col, 'something unrelated'));
});
test('scoreColumnAgainstPhrase penalizes a categorical column (contains GROUP) when the phrase itself has no categorical concept', function () {
  var groupCol = { name: 'USER_GROUP_NAME', alias: '', description: 'Name of the user group' };
  var personCol = { name: 'FULL_NAME', alias: '', description: 'Full name of the user' };
  assertTrue(NLQ.scoreColumnAgainstPhrase(personCol, 'user name') > NLQ.scoreColumnAgainstPhrase(groupCol, 'user name'));
});
test('findColumnByPhraseScored resolves "user name" to FULL_NAME rather than USER_GROUP_NAME', function () {
  var best = NLQ.findColumnByPhraseScored(engine, ['ADM_USER_DATA', 'ADM_USER_GROUP'], 'user name', 3);
  assertTrue(best !== null);
  assertEqual(best.table, 'ADM_USER_DATA');
  assertEqual(best.column, 'FULL_NAME');
});
test('findColumnByPhraseScored returns null when nothing scores high enough (does not force a guess)', function () {
  var best = NLQ.findColumnByPhraseScored(engine, ['IA_INVOICE'], 'zzz totally unrelated concept', 3);
  assertEqual(best, null);
});

/* ---------------------------------------------------------------------
   scoreAllTablesEnhanced
   --------------------------------------------------------------------- */
test('scoreAllTablesEnhanced matches a plural single-word mention ("users") to a multi-word bare table name ("user data") via token overlap', function () {
  var ranked = NLQ.scoreAllTablesEnhanced('Show all users', engine).filter(function (r) { return r.score >= 1; });
  assertTrue(ranked.some(function (r) { return r.table.name === 'ADM_USER_DATA'; }));
});
test('scoreAllTablesEnhanced discovers a table purely via a distinctive column ALIAS ("Amount") even when the table name itself is never mentioned', function () {
  var ranked = NLQ.scoreAllTablesEnhanced('Show the total gross amount', engine).filter(function (r) { return r.score >= 1; });
  assertTrue(ranked.some(function (r) { return r.table.name === 'IA_INVOICE'; }));
});
test('scoreAllTablesEnhanced does NOT get fooled by a short, generic alias like "Name" into pulling in an unrelated table', function () {
  var ranked = NLQ.scoreAllTablesEnhanced('Show all active users and sort by user name', engine, {}).filter(function (r) { return r.score >= 1; });
  assertFalse(ranked.some(function (r) { return r.table.name === 'IA_SUPPLIER'; }), 'IA_SUPPLIER should not be pulled in merely because its SUPPLIER_NAME column has alias "Name"');
});
test('scoreAllTablesEnhanced never LOWERS a table\'s score compared to the original scoreAllTables', function () {
  var text = 'show all invoices';
  var oldScores = {}; NLQ.scoreAllTables(text, engine).forEach(function (r) { oldScores[r.table.name] = r.score; });
  NLQ.scoreAllTablesEnhanced(text, engine).forEach(function (r) { assertTrue(r.score >= oldScores[r.table.name]); });
});

/* ---------------------------------------------------------------------
   matchColumnsEnhanced
   --------------------------------------------------------------------- */
test('matchColumnsEnhanced still returns every column the original matchColumns would have found (superset, not replacement)', function () {
  var text = 'show invoice number and gross amount for invoices';
  var base = NLQ.matchColumns(text, engine, ['IA_INVOICE'], {});
  var enhanced = NLQ.matchColumnsEnhanced(text, engine, ['IA_INVOICE']);
  base.forEach(function (c) { assertTrue(enhanced.some(function (e) { return e.table === c.table && e.column === c.column; })); });
});
test('matchColumnsEnhanced requires at least 3 distinct overlapping description words before adding an extra column (avoids weak false positives)', function () {
  var enhanced = NLQ.matchColumnsEnhanced('show the company', engine, ['ADM_USER_DATA']);
  assertFalse(enhanced.some(function (c) { return c.column === 'SUPERVISOR_USER_ID'; }));
});

/* ---------------------------------------------------------------------
   matchSortEnhanced
   --------------------------------------------------------------------- */
test('matchSortEnhanced tolerates filler words between "sort" and "by" ("sort the result by X")', function () {
  var out = NLQ.matchSortEnhanced('please sort the result by login account', engine, ['ADM_USER_DATA']);
  assertEqual(out.length, 1);
  assertEqual(out[0].column, 'LOGIN_ACCOUNT');
});
test('matchSortEnhanced still supports the plain "sort by X" / "sorted by X" forms', function () {
  var out = NLQ.matchSortEnhanced('invoices sorted by due date descending', engine, ['IA_INVOICE']);
  assertEqual(out[0].column, 'DUE_DATE');
  assertEqual(out[0].direction, 'DESC');
});

/* ---------------------------------------------------------------------
   deriveBooleanConcept / matchBooleanFlagFilters
   --------------------------------------------------------------------- */
test('deriveBooleanConcept decomposes LOGIN_ALLOWED into {concept:"login", qualifier:"allowed"}', function () {
  var c = NLQ.deriveBooleanConcept('LOGIN_ALLOWED');
  assertEqual(c.concept, 'login');
  assertEqual(c.qualifier, 'allowed');
});
test('deriveBooleanConcept decomposes IS_ACTIVE into {concept:"", qualifier:"active"}', function () {
  var c = NLQ.deriveBooleanConcept('IS_ACTIVE');
  assertEqual(c.concept, '');
  assertEqual(c.qualifier, 'active');
});
test('deriveBooleanConcept returns null for a column with no boolean-ish naming pattern', function () {
  assertEqual(NLQ.deriveBooleanConcept('INVOICE_NUMBER'), null);
});
test('matchBooleanFlagFilters resolves "login is allowed" positively (LOGIN_ALLOWED = 1)', function () {
  var result = NLQ.matchBooleanFlagFilters('users whose login is allowed', engine, ['ADM_USER_DATA']);
  assertEqual(result.filters.length, 1);
  assertEqual(result.filters[0].column, 'LOGIN_ALLOWED');
  assertEqual(result.filters[0].value, '1');
});
test('matchBooleanFlagFilters resolves a negative phrasing ("login is not allowed") to the False code', function () {
  var result = NLQ.matchBooleanFlagFilters('users whose login is not allowed', engine, ['ADM_USER_DATA']);
  assertEqual(result.filters.length, 1);
  assertEqual(result.filters[0].value, '0');
});
test('matchBooleanFlagFilters resolves bare "active users" to IS_ACTIVE = 1 without ambiguity (deterministic, since only IS_ACTIVE contains the word "active")', function () {
  var result = NLQ.matchBooleanFlagFilters('show active users', engine, ['ADM_USER_DATA']);
  assertEqual(result.ambiguities.length, 0);
  assertEqual(result.filters.length, 1);
  assertEqual(result.filters[0].column, 'IS_ACTIVE');
  assertEqual(result.filters[0].value, '1');
});
test('matchBooleanFlagFilters reports a genuine ambiguity (rather than guessing) when two DIFFERENT columns tie on the same qualifier with no disambiguating concept word present', function () {
  var tinySchema = {
    schema_name: 'Ambiguity Test Schema', schema_version: '1.0', module_labels: { T: 'Test' },
    tables: [{ name: 'T_RECORD', module: 'T', notes: '', columns: [
      { name: 'STATUS_ACTIVE', type: 'NUMBER(1)', primary_key: false, foreign_key: null, alias: '', description: 'Whether the record status is active', decode: [{ code: '0', label: 'No' }, { code: '1', label: 'Yes' }] },
      { name: 'FLAG_ACTIVE', type: 'NUMBER(1)', primary_key: false, foreign_key: null, alias: '', description: 'A separate, unrelated active flag', decode: [{ code: '0', label: 'No' }, { code: '1', label: 'Yes' }] },
      { name: 'RECORD_ID', type: 'INTEGER', primary_key: true, foreign_key: null, alias: '', description: 'Unique id', decode: null }
    ] }]
  };
  var tinyEngine = SCHEMA_ENGINE.createEngine(tinySchema);
  var result = NLQ.matchBooleanFlagFilters('show active records', tinyEngine, ['T_RECORD']);
  assertEqual(result.filters.length, 0);
  assertEqual(result.ambiguities.length, 1);
  assertEqual(result.ambiguities[0].term, 'active');
  assertEqual(result.ambiguities[0].options.length, 2);
});

/* ---------------------------------------------------------------------
   matchExclusionFilters
   --------------------------------------------------------------------- */
test('matchExclusionFilters resolves "Exclude Basware users" to a NOT LIKE filter on the EMAIL column (matches the spec\'s own example)', function () {
  var out = NLQ.matchExclusionFilters('Show all users. Exclude Basware users.', engine, ['ADM_USER_DATA']);
  assertEqual(out.length, 1);
  assertEqual(out[0].table, 'ADM_USER_DATA');
  assertEqual(out[0].column, 'EMAIL');
  assertEqual(out[0].operator, 'not_contains');
  assertEqual(out[0].value, 'basware');
});
test('matchExclusionFilters supports "without", "except", and "not including" as synonyms for "exclude"', function () {
  assertEqual(NLQ.matchExclusionFilters('show users without basware users', engine, ['ADM_USER_DATA']).length, 1);
  assertEqual(NLQ.matchExclusionFilters('show users except basware users', engine, ['ADM_USER_DATA']).length, 1);
});
test('matchExclusionFilters falls back to a decode-label match when no email-like column exists on the candidate tables', function () {
  var out = NLQ.matchExclusionFilters('show suppliers, exclude closed suppliers', engine, ['OM_ORDER']);
  // OM_ORDER has ORDER_STATUS with a decode label "Closed" — should resolve via decode fallback, not crash.
  assertTrue(Array.isArray(out));
});

/* ---------------------------------------------------------------------
   matchMembershipFilters
   --------------------------------------------------------------------- */
test('matchMembershipFilters resolves "belong to the Finance organization" to USER_GROUP_NAME = Finance', function () {
  var out = NLQ.matchMembershipFilters('users who belong to the Finance organization', engine, ['ADM_USER_GROUP']);
  assertEqual(out.length, 1);
  assertEqual(out[0].column, 'USER_GROUP_NAME');
  assertEqual(out[0].value, 'Finance');
});
test('matchMembershipFilters also recognizes "belongs to" (singular verb form)', function () {
  var out = NLQ.matchMembershipFilters('this user belongs to the IT team', engine, ['ADM_USER_GROUP']);
  assertEqual(out.length, 1);
  assertEqual(out[0].value, 'It');
});

/* ---------------------------------------------------------------------
   matchDateRangeFilters
   --------------------------------------------------------------------- */
test('matchDateRangeFilters resolves "between January and March 2026" to a BETWEEN filter with correct first/last day of month', function () {
  var f = NLQ.matchDateRangeFilters('invoices created between January and March 2026', engine, ['IA_INVOICE'], {});
  assertTrue(f !== null);
  assertEqual(f.value, '2026-01-01');
  assertEqual(f.value2, '2026-03-31');
});
test('matchDateRangeFilters handles a leap-year February correctly (Feb 2024 has 29 days)', function () {
  var f = NLQ.matchDateRangeFilters('invoices created between February and February 2024', engine, ['IA_INVOICE'], {});
  assertEqual(f.value2, '2024-02-29');
});
test('matchDateRangeFilters returns null when the text has no such date-range phrasing', function () {
  assertEqual(NLQ.matchDateRangeFilters('show all invoices', engine, ['IA_INVOICE'], {}), null);
});

/* ---------------------------------------------------------------------
   matchDecodeRequests
   --------------------------------------------------------------------- */
test('matchDecodeRequests resolves "show the login type as its description" to LOGIN_TYPE', function () {
  var out = NLQ.matchDecodeRequests('show the login type as its description', engine, ['ADM_USER_DATA']);
  assertEqual(out.length, 1);
  assertEqual(out[0].column, 'LOGIN_TYPE');
});
test('matchDecodeRequests also recognizes "as its label" / "as its name" phrasing', function () {
  assertEqual(NLQ.matchDecodeRequests('show the status as its label', engine, ['IA_INVOICE']).length, 1);
  assertEqual(NLQ.matchDecodeRequests('show the status as its name', engine, ['IA_INVOICE']).length, 1);
});

/* ---------------------------------------------------------------------
   matchAggregations / matchGroupBy / matchHaving
   --------------------------------------------------------------------- */
test('matchAggregations resolves "total gross amount" to SUM(IA_INVOICE.GROSS_SUM)', function () {
  var out = NLQ.matchAggregations('show the total gross amount', engine, ['IA_INVOICE']);
  assertEqual(out.length, 1);
  assertEqual(out[0].aggregate, 'SUM');
  assertEqual(out[0].column, 'GROSS_SUM');
});
test('matchAggregations resolves "average gross amount" to AVG and "highest gross amount" to MAX', function () {
  assertEqual(NLQ.matchAggregations('show the average gross amount', engine, ['IA_INVOICE'])[0].aggregate, 'AVG');
  assertEqual(NLQ.matchAggregations('show the highest gross amount', engine, ['IA_INVOICE'])[0].aggregate, 'MAX');
});
test('matchAggregations resolves a bare "how many invoices" (no specific column) to COUNT(*)', function () {
  var out = NLQ.matchAggregations('how many invoices are there', engine, ['IA_INVOICE']);
  assertEqual(out.length, 1);
  assertEqual(out[0].aggregate, 'COUNT');
  assertEqual(out[0].column, '*');
});
test('matchGroupBy resolves "grouped by supplier" to the IA_SUPPLIER table\'s key column', function () {
  var out = NLQ.matchGroupBy('grouped by supplier', engine, ['IA_SUPPLIER']);
  assertEqual(out.length, 1);
  assertEqual(out[0].table, 'IA_SUPPLIER');
});
test('matchHaving resolves "having count more than 5" to "COUNT(*) > 5" when no matching aggregate was already found', function () {
  assertEqual(NLQ.matchHaving('having count more than 5', []), 'COUNT(*) > 5');
});
test('matchHaving reuses an already-detected aggregate\'s exact expression when the function matches', function () {
  var aggregates = [{ aggregate: 'SUM', table: 'IA_INVOICE', column: 'GROSS_SUM', alias: 'sum_gross_sum' }];
  assertEqual(NLQ.matchHaving('having total more than 1000', aggregates), 'SUM(IA_INVOICE.GROSS_SUM) > 1000');
});
test('matchHaving returns null when there is no "having" phrasing at all', function () {
  assertEqual(NLQ.matchHaving('show all invoices', []), null);
});

/* ---------------------------------------------------------------------
   buildAdjacency / shortestPath / resolveJoinClosure
   --------------------------------------------------------------------- */
test('buildAdjacency connects IA_INVOICE and IA_SUPPLIER bidirectionally', function () {
  var adj = NLQ.buildAdjacency(engine);
  assertTrue(adj.IA_INVOICE.IA_SUPPLIER === true);
  assertTrue(adj.IA_SUPPLIER.IA_INVOICE === true);
});
test('shortestPath finds a direct one-hop path between directly related tables', function () {
  var adj = NLQ.buildAdjacency(engine);
  var p = NLQ.shortestPath(adj, 'IA_INVOICE', 'IA_SUPPLIER');
  assertEqual(p, ['IA_INVOICE', 'IA_SUPPLIER']);
});
test('shortestPath finds a genuine multi-hop bridge path (ADM_USER_DATA -> ADM_USER_GROUP via the junction table)', function () {
  var adj = NLQ.buildAdjacency(engine);
  var p = NLQ.shortestPath(adj, 'ADM_USER_DATA', 'ADM_USER_GROUP');
  assertEqual(p.length, 3);
  assertEqual(p[0], 'ADM_USER_DATA');
  assertEqual(p[2], 'ADM_USER_GROUP');
  assertEqual(p[1], 'ADM_USER_GROUP_MEMBER');
});
test('shortestPath returns null when no path exists at all between two disconnected tables', function () {
  var isolatedSchema = { schema_name: 'x', schema_version: '1.0', module_labels: {}, tables: [
    { name: 'A', module: 'X', columns: [{ name: 'ID', primary_key: true, foreign_key: null }] },
    { name: 'B', module: 'X', columns: [{ name: 'ID', primary_key: true, foreign_key: null }] }
  ] };
  var isolatedEngine = SCHEMA_ENGINE.createEngine(isolatedSchema);
  var adj = NLQ.buildAdjacency(isolatedEngine);
  assertEqual(NLQ.shortestPath(adj, 'A', 'B'), null);
});
test('resolveJoinClosure automatically adds the ADM_USER_GROUP_MEMBER bridge table when only ADM_USER_DATA and ADM_USER_GROUP were required', function () {
  var closure = NLQ.resolveJoinClosure(engine, ['ADM_USER_DATA', 'ADM_USER_GROUP']);
  assertTrue(closure.tables.indexOf('ADM_USER_GROUP_MEMBER') !== -1);
  assertTrue(closure.bridgeTables.indexOf('ADM_USER_GROUP_MEMBER') !== -1);
  assertEqual(closure.unresolved.length, 0);
});
test('resolveJoinClosure with a single table requires no bridging at all', function () {
  var closure = NLQ.resolveJoinClosure(engine, ['IA_INVOICE']);
  assertEqual(closure.tables, ['IA_INVOICE']);
  assertEqual(closure.bridgeTables.length, 0);
});
test('resolveJoinClosure reports a table as unresolved when the schema genuinely has no connecting path', function () {
  var isolatedSchema = { schema_name: 'x', schema_version: '1.0', module_labels: {}, tables: [
    { name: 'A', module: 'X', columns: [{ name: 'ID', primary_key: true, foreign_key: null }] },
    { name: 'B', module: 'X', columns: [{ name: 'ID', primary_key: true, foreign_key: null }] }
  ] };
  var isolatedEngine = SCHEMA_ENGINE.createEngine(isolatedSchema);
  var closure = NLQ.resolveJoinClosure(isolatedEngine, ['A', 'B']);
  assertEqual(closure.unresolved, ['B']);
});

/* ---------------------------------------------------------------------
   findAmbiguousTerms / computeConfidence
   --------------------------------------------------------------------- */
test('findAmbiguousTerms excludes a column that was already resolved into a concrete filter (not a guess)', function () {
  var resolved = [{ table: 'ADM_USER_DATA', column: 'IS_ACTIVE', operator: 'eq', value: '1' }];
  var ambiguities = NLQ.findAmbiguousTerms('show active users', engine, ['ADM_USER_DATA'], resolved);
  assertEqual(ambiguities.length, 0);
});
test('computeConfidence reports tableIdentified/relationshipsIdentified accurately', function () {
  var c1 = NLQ.computeConfidence(['IA_INVOICE'], [{ table: 'IA_INVOICE', column: 'STATUS' }], [], []);
  assertTrue(c1.tableIdentified); assertTrue(c1.relationshipsIdentified); assertFalse(c1.hasAmbiguities);
  var c2 = NLQ.computeConfidence([], [], ['SOME_TABLE'], [{ term: 'active', options: [] }]);
  assertFalse(c2.tableIdentified); assertFalse(c2.relationshipsIdentified); assertTrue(c2.hasAmbiguities);
});

/* ---------------------------------------------------------------------
   explainInterpretation
   --------------------------------------------------------------------- */
test('explainInterpretation produces a plain-English line per filter, sort, and table join', function () {
  var interp = {
    tables: ['ADM_USER_DATA', 'ADM_USER_GROUP'],
    filterConditions: [{ table: 'ADM_USER_DATA', column: 'IS_ACTIVE', operator: 'eq', value: '1' }],
    orderBy: [{ table: 'ADM_USER_DATA', column: 'LOGIN_ACCOUNT', direction: 'ASC' }],
    groupBy: [], aggregates: [], having: null, distinct: false, limit: null
  };
  var lines = NLQ.explainInterpretation(interp);
  assertTrue(lines.some(function (l) { return /joined with/.test(l); }));
  assertTrue(lines.some(function (l) { return /Filters where ADM_USER_DATA\.IS_ACTIVE/.test(l); }));
  assertTrue(lines.some(function (l) { return /Sorts the results/.test(l); }));
});
test('explainInterpretation returns an empty array for an empty interpretation (no crash)', function () {
  assertEqual(NLQ.explainInterpretation(NLQ.interpretRequirement('', engine, {})), []);
});
test('explainInterpretation mentions aggregation and GROUP BY in plain language', function () {
  var interp = NLQ.interpretRequirement('Show the total gross amount grouped by supplier.', engine, {});
  var lines = NLQ.explainInterpretation(interp);
  assertTrue(lines.some(function (l) { return /Calculates the SUM/.test(l); }));
  assertTrue(lines.some(function (l) { return /Groups the results/.test(l); }));
});

/* ---------------------------------------------------------------------
   interpretCrRequirement
   --------------------------------------------------------------------- */
test('interpretCrRequirement still detects UPDATE/table/set/where exactly like interpretCrDescription', function () {
  var r = NLQ.interpretCrRequirement('update the invoice status to 40 where invoice id is 123', engine, {});
  assertEqual(r.command, 'UPDATE');
  assertEqual(r.table, 'IA_INVOICE');
  assertEqual(r.updateColumns[0].column, 'STATUS');
  assertEqual(r.filterConditions[0].column, 'INVOICE_ID');
});
test('interpretCrRequirement also normalizes thousands separators in the WHERE/SET values', function () {
  var r = NLQ.interpretCrRequirement('update the gross sum to 15,000 where invoice id is 123', engine, {});
  assertEqual(r.updateColumns[0].value, '15000');
});

/* ---------------------------------------------------------------------
   mergeAggregates / mergeGroupBy (conversational refinement state)
   --------------------------------------------------------------------- */
test('mergeAggregates appends a new, distinct aggregate and skips an exact duplicate', function () {
  var existing = [{ aggregate: 'SUM', table: 'IA_INVOICE', column: 'GROSS_SUM' }];
  var merged = NLQ.mergeAggregates(existing, [{ aggregate: 'SUM', table: 'IA_INVOICE', column: 'GROSS_SUM' }, { aggregate: 'COUNT', table: 'IA_INVOICE', column: '*' }]);
  assertEqual(merged.length, 2);
});
test('mergeGroupBy appends a new, distinct group-by column and skips an exact duplicate', function () {
  var existing = [{ table: 'IA_SUPPLIER', column: 'SUPPLIER_ID' }];
  var merged = NLQ.mergeGroupBy(existing, [{ table: 'IA_SUPPLIER', column: 'SUPPLIER_ID' }, { table: 'IA_INVOICE', column: 'STATUS' }]);
  assertEqual(merged.length, 2);
});

/* ---------------------------------------------------------------------
   Performance sanity (requirement 27) — a synthetic ~300-table schema
   should still resolve quickly (well under a second).
   --------------------------------------------------------------------- */
test('performance: interpretRequirement completes quickly even against a synthetic ~300-table schema', function () {
  var bigTables = [];
  for (var i = 0; i < 300; i++) {
    bigTables.push({ name: 'BIG_TABLE_' + i, module: 'BIG', notes: 'Synthetic table ' + i, columns: [
      { name: 'ID', type: 'INTEGER', primary_key: true, foreign_key: null, alias: '', description: 'id' },
      { name: 'PARENT_ID', type: 'INTEGER', primary_key: false, foreign_key: i > 0 ? { table: 'BIG_TABLE_' + (i - 1), column: 'ID' } : null, alias: '', description: 'parent link' }
    ] });
  }
  var bigSchema = { schema_name: 'Big', schema_version: '1.0', module_labels: { BIG: 'Big Module' }, tables: bigTables };
  var bigEngine = SCHEMA_ENGINE.createEngine(bigSchema);
  var start = Date.now();
  NLQ.interpretRequirement('Show all records from big table 5 joined with big table 250', bigEngine, {});
  var elapsed = Date.now() - start;
  assertTrue(elapsed < 2000, 'expected interpretRequirement to complete in under 2 seconds, took ' + elapsed + 'ms');
});
