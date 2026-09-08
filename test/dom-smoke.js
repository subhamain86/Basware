'use strict';
/**
 * dom-smoke.js — a lightweight DOM/Bootstrap simulation that loads the REAL
 * app.js and exercises the highest-risk interactive code paths end-to-end,
 * including all V10.0 additions:
 *   - The Error Rectifier page routes correctly via the existing generic
 *     [data-view]/.app-view mechanism (no special-casing needed there).
 *   - Clicking "Rectify SQL" runs the real error-rectifier-engine.js
 *     against the real active schema engine and renders a corrected SQL
 *     block, an explanation, and a "What Changed" list end-to-end.
 *   - Dialect auto-detection from the pasted error text actually updates
 *     the dialect dropdown before rectifying.
 *   - Copy SQL / Copy Explanation buttons become visible after a result.
 *   - The data-type-aware Decode SQL generation (verified directly via the
 *     real sql-engine.js/decode-engine.js/datatype-engine.js modules,
 *     exactly as app.js's buildOptions()/collectSelectedColumns() would
 *     invoke them).
 * Everything carried over from V9.2 (schema persistence across a
 * simulated reload, order-independent joins, Define Relationship,
 * Suggested Fixes, Update Schema reauth + delete flow) is also
 * re-verified here to confirm no regression.
 */
var fs = require('fs');
var path = require('path');

function El(tag) {
  var cls = new Set(); var handlers = {}; var attrs = {}; var childrenArr = [];
  var el = {
    tagName: (tag || 'div').toUpperCase(), type: '', _value: '', checked: false, disabled: false,
    placeholder: '', title: '', children: childrenArr, files: null, href: '', download: '',
    style: (function () {
      var styleTarget = { setProperty: function () {}, getPropertyValue: function () { return ''; } };
      return new Proxy(styleTarget, {
        get: function (target, prop) { return prop in target ? target[prop] : ''; },
        set: function (target, prop, value) { target[prop] = value; return true; }
      });
    })(),
    set value(v) { this._value = v; }, get value() { return this._value; },
    set innerHTML(v) { this._html = v; if (v === '') this.children = []; }, get innerHTML() { return this._html || ''; },
    set textContent(v) { this._text = v; }, get textContent() { return this._text || ''; },
    classList: {
      add: function (c) { cls.add(c); }, remove: function (c) { cls.delete(c); },
      toggle: function (c, f) { if (f === undefined) f = !cls.has(c); if (f) cls.add(c); else cls.delete(c); return f; },
      contains: function (c) { return cls.has(c); }
    },
    _cls: cls,
    setAttribute: function (k, v) { attrs[k] = v; }, getAttribute: function (k) { return attrs[k] !== undefined ? attrs[k] : null; },
    addEventListener: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    dispatch: function (ev, payload) { (handlers[ev] || []).forEach(function (fn) { fn(payload || { target: el }); }); },
    appendChild: function (c) { this.children.push(c); return c; },
    removeChild: function (c) { var i = this.children.indexOf(c); if (i !== -1) this.children.splice(i, 1); },
    querySelector: function () { return El('input'); },
    querySelectorAll: function () { return []; },
    click: function () { this.dispatch('click'); },
    closest: function () { return null; }, scrollIntoView: function () {}, focus: function () {},
    getBoundingClientRect: function () { return { top: 0, left: 0, width: 100, height: 20, right: 100, bottom: 20 }; },
    offsetWidth: 340, offsetHeight: 64
  };
  return el;
}

var registry = {};
global.document = {
  getElementById: function (id) { return registry[id] || (registry[id] = El()); },
  querySelector: function () { return El('div'); },
  querySelectorAll: function (sel) { return registry['__qsa_' + sel] || []; },
  createElement: function (t) { return El(t); },
  addEventListener: function () {},
  body: El(), documentElement: El()
};
global.window = {
  addEventListener: function () {}, innerWidth: 1200, innerHeight: 800, scrollTo: function () {},
  matchMedia: function () { return { matches: false, addEventListener: function () {} }; }
};
global.window.__AP_SCHEMA__ = require(path.join(__dirname, '..', 'schema', 'schema-sample.js'));
global.window.bootstrap = {
  Modal: function () { this.show = function () {}; this.hide = function () {}; },
  Offcanvas: function () { this.hide = function () {}; }
};
var localStorageBackingStore = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(localStorageBackingStore, k) ? localStorageBackingStore[k] : null; },
  setItem: function (k, v) { localStorageBackingStore[k] = String(v); }
};
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: function () {} } }, configurable: true, writable: true });
var downloadedFiles = [];
global.URL = {
  createObjectURL: function (blob) { downloadedFiles.push(blob); return 'blob:mock-' + downloadedFiles.length; },
  revokeObjectURL: function () {}
};
var realSetTimeout = setTimeout;
global.setTimeout = function (fn) { try { fn(); } catch (e) { throw e; } };
Object.defineProperty(global, 'crypto', { value: undefined, configurable: true, writable: true });

global.APSQL = require(path.join(__dirname, '..', 'js', 'schema-engine.js'));
global.APSQL_DATATYPE = require(path.join(__dirname, '..', 'js', 'datatype-engine.js'));
global.APSQL_FILTER = require(path.join(__dirname, '..', 'js', 'filter-engine.js'));
global.APSQL_DECODE = require(path.join(__dirname, '..', 'js', 'decode-engine.js'));
global.APSQL_VALIDATE = require(path.join(__dirname, '..', 'js', 'validation-engine.js'));
global.APSQL_ENGINE = require(path.join(__dirname, '..', 'js', 'sql-engine.js'));
global.APSQL_CR = require(path.join(__dirname, '..', 'js', 'cr-engine.js'));
global.APSQL_SCHEMA_TOOLS = require(path.join(__dirname, '..', 'js', 'schema-tools.js'));
global.APSQL_RELATIONSHIPS = require(path.join(__dirname, '..', 'js', 'relationship-store.js'));
global.APSQL_SUGGEST = require(path.join(__dirname, '..', 'js', 'suggestion-engine.js'));
global.APSQL_OPTIMIZE = require(path.join(__dirname, '..', 'js', 'optimize-engine.js'));
global.APSQL_ERROR_RECTIFIER = require(path.join(__dirname, '..', 'js', 'error-rectifier-engine.js'));

var REQUIRED_IDS = [
  'mainNavbar', 'mainMenu', 'queryBuilderMenuToggle', 'queryBuilderSubmenu', 'schemaMenuToggle', 'schemaSubmenu',
  'themeMenuToggle', 'themeSubmenu', 'aboutMenuBtn', 'aboutModal', 'aboutList',
  'qsExampleGrid', 'qsModuleChips',
  'moduleFilterSel', 'tableSearchInput', 'tableSelectAllBtn', 'tableUnselectAllBtn', 'tableSelCount', 'tableListGrid',
  'selectedTableDropdown', 'columnSearchInput', 'columnSelectAllBtn', 'columnUnselectAllBtn', 'columnListBody', 'columnListEmpty',
  'readOnlyFilterGroup', 'readOnlyAddFilterBtn', 'readOnlyClearFiltersBtn',
  'joinOptionCard', 'optJoinInner', 'optJoinLeft', 'optJoinInnerLabel', 'optJoinLeftLabel', 'joinResetBtn', 'joinPreviewBox', 'defineRelationshipContainer',
  'sortRowsContainer', 'addSortRowBtn', 'clearSortBtn',
  'optLimit', 'optLimitClearBtn', 'optView', 'optViewClearBtn',
  'existsRowsContainer', 'addExistsRowBtn', 'clearExistsBtn',
  'scalarRowsContainer', 'addScalarRowBtn', 'clearScalarBtn',
  'optHaving', 'optHavingClearBtn', 'optHierarchy', 'optHierarchyClearBtn',
  'promptInput', 'dialectSel', 'optDistinct2', 'generateBtn', 'resultBody', 'copyBtn', 'optimizeBtn', 'optimizeReportBox',
  'manualTabs', 'requirementsSummaryBody',
  'crCommandSelector', 'crDialectSel', 'crTableSelect', 'crDescriptionInput', 'crBuildBtn',
  'crInsertPanel', 'crInsertColumnsBody', 'crUpdatePanel', 'crUpdateColumnsBody',
  'crWherePanel', 'crWhereRequiredWarning', 'crFilterGroup', 'crAddFilterBtn', 'crClearFiltersBtn', 'crAllowNoWhere',
  'crDecodePanel', 'crDecodeBody', 'crRequirementsSummaryBody', 'crResultBody', 'crCopyBtn', 'crOptimizeBtn', 'crOptimizeReportBox', 'crManualTabs',
  'schemaSearchInput', 'schemaSearchClearBtn', 'schemaSearchResultCount', 'schemaSearchNoResults', 'schemaTree', 'usedSchemaSummary',
  'schemaPersistenceStatus',
  'updateSchemaPasswordStep', 'updateSchemaPasswordInput', 'updateSchemaPasswordBtn', 'updateSchemaPasswordError', 'updateSchemaWorkArea',
  'downloadCurrentJsonBtn', 'downloadCurrentCsvBtn', 'downloadCurrentDocxBtn', 'downloadCurrentXlsxBtn', 'downloadCurrentDocBtn',
  'workflowStepList', 'updateSchemaFileInput', 'updateSchemaProcessBtn', 'toggleExpectedStructureBtn', 'expectedStructureBox', 'unsupportedFormatError',
  'downloadJsonSampleBtn', 'downloadCsvSampleBtn', 'downloadDocxSampleBtn', 'downloadXlsxSampleBtn', 'downloadDocSampleBtn',
  'validationResultBox', 'updateSchemaResult', 'updateSchemaPreviewCard', 'previewCurrentBox', 'previewNewBox', 'previewChangesBox', 'previewDetailBox',
  'activateSchemaBtn', 'cancelPreviewBtn',
  'reauthApplyModal', 'reauthApplyPasswordInput', 'reauthApplyPasswordError', 'confirmReauthApplyBtn',
  'deleteSchemaBtn', 'deleteSchemaModal', 'deleteSchemaPasswordInput', 'deleteSchemaPasswordError', 'confirmDeleteSchemaBtn',
  'saveRelationshipModal', 'saveRelationshipSummary', 'saveRelationshipPasswordInput', 'saveRelationshipPasswordError', 'confirmSaveRelationshipBtn',
  'errErrorInput', 'errSqlInput', 'errDialectSel', 'errRectifyBtn', 'errRectifiedSqlBody', 'errCopySqlBtn', 'errExplanationBody', 'errCopyExplanationBtn', 'errWhatChangedCard', 'errWhatChangedBody',
  'tourBtn', 'tourOverlay', 'tourSpotlight', 'tourPopup', 'tourStepLabel', 'tourTitle', 'tourBody', 'tourDots', 'tourPrev', 'tourNext', 'tourSkip'
];
REQUIRED_IDS.forEach(function (id) { registry[id] = El(id === 'updateSchemaFileInput' ? 'input' : 'div'); });

var viewBtns = ['quickstart', 'builder', 'crbuilder', 'usedschema', 'updateschema', 'errorrectifier'].map(function (v) {
  var b = El('button'); b.setAttribute('data-view', v); if (v === 'quickstart') b.classList.add('active'); return b;
});
registry['__qsa_[data-view]'] = viewBtns;
var appViews = ['quickstart', 'builder', 'crbuilder', 'usedschema', 'updateschema', 'errorrectifier'].map(function (v) {
  var el = El('section'); el.id = 'view-' + v; if (v === 'quickstart') el.classList.add('active'); return el;
});
registry['__qsa_.app-view'] = appViews;
registry['__qsa_.offcanvas-body > button.nav-link, .menu-submenu .nav-link'] = viewBtns;
registry['__qsa_[data-theme]'] = [];
registry['__qsa_.cr-command-option'] = ['INSERT', 'UPDATE', 'DELETE'].map(function (c) { var b = El('div'); b.setAttribute('data-command', c); if (c === 'INSERT') b.classList.add('active'); return b; });
registry['__qsa_#manualTabs .nav-link'] = ['tables', 'advanced', 'requirements'].map(function (t) { var b = El('button'); b.setAttribute('data-tab', t); if (t === 'tables') b.classList.add('active'); return b; });
registry['__qsa_.tab-pane-manual'] = ['tables', 'advanced', 'requirements'].map(function (t) { var el = El('div'); el.id = 'pane-' + t; if (t === 'tables') { el.classList.add('active'); } else { el.classList.add('d-none'); } return el; });
registry['__qsa_#crManualTabs .nav-link'] = ['tables', 'requirements'].map(function (t) { var b = El('button'); b.setAttribute('data-cr-tab', t); if (t === 'tables') b.classList.add('active'); return b; });
registry['__qsa_.tab-pane-cr'] = ['tables', 'requirements'].map(function (t) { var el = El('div'); el.id = 'cr-pane-' + t; if (t === 'tables') el.classList.add('active'); else el.classList.add('d-none'); return el; });
registry['__qsa_input[name="joinType"]'] = [registry['optJoinInner'], registry['optJoinLeft']];

var pass = 0, fail = 0;
function ok(msg, cond) { if (cond) { pass++; } else { fail++; console.log('  \u2717 ' + msg); } }

require(path.join(__dirname, '..', 'js', 'app.js'));

ok('app.js loads without throwing against the mocked DOM', true);
ok('Join option card is hidden by default when fewer than two tables are selected', registry['joinOptionCard']._cls.has('d-none'));

registry['generateBtn'].dispatch('click');
ok('Build Query with no tables selected shows a clarification message + Suggested fixes', /one more detail needed/i.test(registry['resultBody']._html || '') && /Suggested fixes/i.test(registry['resultBody']._html || ''));

/* ---- V10.0: Error Rectifier — full end-to-end round trip through the real routing + real engine ---- */
registry['errErrorInput'].value = 'ORA-00932: inconsistent datatypes: expected CHAR got NUMBER';
registry['errSqlInput'].value = "SELECT\n    LOGIN_TYPE,\n    CASE\n        WHEN LOGIN_TYPE = 0 THEN 'Forms'\n        WHEN LOGIN_TYPE = 1 THEN 'Windows Domain'\n        ELSE LOGIN_TYPE\n    END AS LOGIN_TYPE\nFROM ADM_USER_DATA;";
registry['errDialectSel'].value = 'Generic'; // deliberately wrong, to prove auto-detection overrides it
registry['errRectifyBtn'].dispatch('click');
ok('Rectify SQL auto-detects Oracle from the pasted ORA- error and updates the dialect dropdown', registry['errDialectSel'].value === 'Oracle');
ok('Rectified SQL box shows the corrected SQL with TO_CHAR applied', /TO_CHAR\(LOGIN_TYPE\)/.test(registry['errRectifiedSqlBody']._html || ''));
ok('Copy SQL button becomes visible after a result', !registry['errCopySqlBtn']._cls.has('d-none'));
ok('Explanation panel shows "Error Identified" and "Correction Applied"', /Error Identified/.test(registry['errExplanationBody']._html || '') && /Correction Applied/.test(registry['errExplanationBody']._html || ''));
ok('Copy Explanation button becomes visible after a result', !registry['errCopyExplanationBtn']._cls.has('d-none'));
ok('"What Changed" card becomes visible and shows the from/to change', !registry['errWhatChangedCard']._cls.has('d-none') && /ELSE LOGIN_TYPE/.test(registry['errWhatChangedBody']._html || '') && /TO_CHAR/.test(registry['errWhatChangedBody']._html || ''));

/* A genuinely unrecognized error + already-fine SQL should honestly report no change, and hide the What Changed card. */
registry['errErrorInput'].value = 'Some brand new error nobody has seen before';
registry['errSqlInput'].value = 'SELECT INVOICE_NUMBER FROM IA_INVOICE WHERE COMPANY_ID = 100';
registry['errDialectSel'].value = 'Oracle';
registry['errRectifyBtn'].dispatch('click');
ok('An unrecognized error + already-correct SQL honestly reports no confident correction', /No specific/.test(registry['errExplanationBody']._html || ''));
ok('"What Changed" card is hidden when nothing changed', registry['errWhatChangedCard']._cls.has('d-none'));

/* ---- V10.0: data-type-aware Decode, exercised via the real modules exactly as app.js's buildOptions()/collectSelectedColumns() would invoke them ---- */
var engineForCheck = APSQL.createEngine(global.window.__AP_SCHEMA__);
var storeForCheck = APSQL_DECODE.createDecodeStore();
var decodeResultOracle = APSQL_ENGINE.generateSql('', { dialect: 'Oracle', selectedTables: ['ADM_USER_DATA'], selectedColumns: [{ table: 'ADM_USER_DATA', column: 'LOGIN_TYPE', alias: 'LOGIN_TYPE', decode: true, elseMode: 'convert' }] }, engineForCheck, storeForCheck);
ok('Data-type-aware Decode (Oracle, convert mode) produces TO_CHAR in the ELSE branch end-to-end', decodeResultOracle.status === 'ok' && /ELSE TO_CHAR\(ADM_USER_DATA\.LOGIN_TYPE\)/.test(decodeResultOracle.sql));
var decodeResultKeep = APSQL_ENGINE.generateSql('', { dialect: 'Oracle', selectedTables: ['ADM_USER_DATA'], selectedColumns: [{ table: 'ADM_USER_DATA', column: 'LOGIN_TYPE', alias: 'LOGIN_TYPE', decode: true, elseMode: 'keep' }] }, engineForCheck, storeForCheck);
ok('elseMode "keep" preserves the exact pre-V10 SQL shape end-to-end', /ELSE ADM_USER_DATA\.LOGIN_TYPE\b/.test(decodeResultKeep.sql) && !/TO_CHAR/.test(decodeResultKeep.sql));

/* ---- Carried forward from V9.2: order-independent multi-table joins + Define Relationship ---- */
var threeTableBadOrder = APSQL_ENGINE.buildJoinPlan(engineForCheck, ['IA_INVOICE', 'OM_ORDER', 'IA_SUPPLIER']);
ok('buildJoinPlan resolves a 3-table chain even in a selection order that used to fail (order-independence, no regression)', threeTableBadOrder.errors.length === 0 && threeTableBadOrder.joins.length === 2);
var relStoreForCheck = APSQL_RELATIONSHIPS.createRelationshipStore();
relStoreForCheck.setManualRelationship('IA_INVOICE', 'COMPANY_ID', 'ADM_USER_DATA', 'USER_ID');
var effEngineForCheck = APSQL_RELATIONSHIPS.createEffectiveEngine(engineForCheck, relStoreForCheck);
var afterMapping = APSQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE', 'ADM_USER_DATA'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }] }, effEngineForCheck, storeForCheck);
ok('"Use for this query" manual relationship mapping still lets a previously-unrelated join succeed (no regression)', afterMapping.status === 'ok');

/* ---- Update Schema: reauth-before-apply + Delete Current Schema flows, plus persistence (no regression) ---- */
function flushMicrotasks(waitMs) { return new Promise(function (resolve) { realSetTimeout(resolve, waitMs || 30); }); }

async function runAsyncChecks() {
  ok('Schema persistence status starts as "using embedded default" (nothing saved yet)', /embedded default/i.test(registry['schemaPersistenceStatus']._html || ''));

  registry['updateSchemaPasswordInput'].value = 'P@assw0rd';
  registry['updateSchemaPasswordBtn'].dispatch('click');
  await flushMicrotasks();
  ok('Correct password reveals the Update Schema work area', registry['updateSchemaWorkArea']._cls.has('d-none') === false);

  var newTableRows = [
    ['Administration', 'ADM_TEST_NEW_TABLE', 'A table added purely for this automated test', 'TEST_ID', 'Unique identifier', 'INTEGER', '', '', 'N', '', '', 'Y', '', '']
  ];
  var csvBlob = global.APSQL_SCHEMA_TOOLS.rowsToCsvBlob([global.APSQL_SCHEMA_TOOLS.SAMPLE_HEADER].concat(newTableRows));
  var csvText = await csvBlob.text();
  var csvFile = { name: 'new-table.csv', text: function () { return Promise.resolve(csvText); } };
  registry['updateSchemaFileInput'].files = [csvFile];
  registry['updateSchemaFileInput'].dispatch('change', { target: registry['updateSchemaFileInput'] });
  registry['updateSchemaProcessBtn'].dispatch('click');
  await flushMicrotasks(80);
  ok('Preview card becomes visible after processing a valid file', registry['updateSchemaPreviewCard']._cls.has('d-none') === false);

  var tableCountBeforeApplyClick = liveSchemaTableCount();
  registry['activateSchemaBtn'].dispatch('click');
  ok('Clicking Apply Schema Update does not immediately change the active schema (reauth required first)', liveSchemaTableCount() === tableCountBeforeApplyClick);

  registry['reauthApplyPasswordInput'].value = 'P@assw0rd';
  registry['confirmReauthApplyBtn'].dispatch('click');
  await flushMicrotasks();
  ok('Correct reauth password applies the schema update (table count increases)', liveSchemaTableCount() > tableCountBeforeApplyClick);

  var storedRaw = global.localStorage.getItem('ap_sql_active_schema_v1');
  ok('Schema was persisted to localStorage after Apply', !!storedRaw);
  var reloadedEngine = APSQL.createEngine(JSON.parse(storedRaw));
  ok('A schema engine rebuilt purely from localStorage (simulating a fresh page load) sees the new table', reloadedEngine.tableExists('ADM_TEST_NEW_TABLE'));
  ok('...and still sees the V10 LOGIN_TYPE fixture column (schema round-trips through JSON correctly)', reloadedEngine.columnExists('ADM_USER_DATA', 'LOGIN_TYPE'));

  var downloadsBeforeDelete = downloadedFiles.length;
  registry['deleteSchemaBtn'].dispatch('click');
  registry['deleteSchemaPasswordInput'].value = 'P@assw0rd';
  registry['confirmDeleteSchemaBtn'].dispatch('click');
  await flushMicrotasks();
  ok('Correct delete password downloads exactly one backup file and empties the schema', downloadedFiles.length === downloadsBeforeDelete + 1 && liveSchemaTableCount() === 0);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

function liveSchemaTableCount() { return JSON.parse(currentSchemaJsonSync()).tables.length; }
function currentSchemaJsonSync() {
  var before = downloadedFiles.length;
  registry['downloadCurrentJsonBtn'].dispatch('click');
  var blob = downloadedFiles[downloadedFiles.length - 1];
  downloadedFiles.length = before;
  return blob.__syncText;
}
global.Blob = function (parts, opts) {
  var text = parts.map(function (p) { return typeof p === 'string' ? p : Buffer.from(p).toString('utf8'); }).join('');
  return { __syncText: text, text: function () { return Promise.resolve(text); }, arrayBuffer: function () { return Promise.resolve(Buffer.from(text)); }, type: (opts || {}).type || '' };
};

runAsyncChecks();
