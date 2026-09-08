'use strict';
/**
 * dom-smoke.js — a lightweight DOM/Bootstrap simulation that loads the REAL
 * app.js and exercises the highest-risk interactive code paths end-to-end,
 * including all V10.1 additions:
 *   - Clicking the NEW "Build Query" button inside the "Describe What You
 *     Need" card, with description text ALONE (no manual table/column
 *     selection at all), actually produces a fully built, correct query —
 *     proving description-only building genuinely works end to end.
 *   - The EXISTING "Build Query" button below the tabs ALSO now honors the
 *     description text (both buttons call the identical routine).
 *   - The "Interpreted from your description" summary box is populated
 *     after a description-driven build.
 *   - A description combined with a pre-existing manual table selection
 *     merges sensibly (manual selection is preserved, description adds to
 *     it) rather than one silently overriding the other.
 *   - The Query Builder for CR's description box can drive the whole
 *     Change Request (command, table, values, WHERE) via its own new
 *     Build Query button.
 *   - The safety-critical "no WHERE without explicit confirmation" rule
 *     is never bypassed by a description alone.
 * Everything carried over from V10.0 (schema persistence across a
 * simulated reload, order-independent joins, Define Relationship, the
 * Error Rectifier round trip, Update Schema reauth + delete flow) is also
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
global.APSQL_NLQUERY = require(path.join(__dirname, '..', 'js', 'nl-query-engine.js'));

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
  'promptInput', 'dialectSel', 'optDistinct2', 'generateBtn', 'generateFromDescriptionBtn', 'descriptionInterpretationBox',
  'resultBody', 'copyBtn', 'optimizeBtn', 'optimizeReportBox',
  'manualTabs', 'requirementsSummaryBody',
  'crCommandSelector', 'crDialectSel', 'crTableSelect', 'crDescriptionInput', 'crBuildBtn', 'crGenerateFromDescriptionBtn', 'crDescriptionInterpretationBox',
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
/* Strips the syntax-highlighting <span> wrapper tags app.js's highlight() inserts around SQL
   keywords (e.g. "<span class='sql-kw'>TOP</span> 3") before running a plain-text regex
   assertion against rendered result HTML, so assertions read naturally regardless of exactly
   which keywords happen to get individually wrapped. */
function stripTags(html) { return String(html || '').replace(/<[^>]+>/g, ''); }

require(path.join(__dirname, '..', 'js', 'app.js'));

ok('app.js loads without throwing against the mocked DOM', true);
ok('Join option card is hidden by default when fewer than two tables are selected', registry['joinOptionCard']._cls.has('d-none'));

/* ---- V10.1: description-ONLY build via the NEW button inside the Describe What You Need card ---- */
registry['promptInput'].value = 'overdue invoices for a supplier in the last 30 days, show invoice number, gross amount and due date';
registry['generateFromDescriptionBtn'].dispatch('click');
ok('Description-only build (new button, zero manual selections) produces a real, successful SQL result', /Query validated against active schema/i.test(registry['resultBody']._html || ''));
ok('...selecting INVOICE_NUMBER, GROSS_SUM, and DUE_DATE as interpreted from the description', /INVOICE_NUMBER/.test(registry['resultBody']._html || '') && /GROSS_SUM/.test(registry['resultBody']._html || '') && /DUE_DATE/.test(registry['resultBody']._html || ''));
ok('The "Interpreted from your description" summary box is populated', /Interpreted from your description/i.test(registry['descriptionInterpretationBox']._html || ''));
ok('Copy Result and Optimize buttons become visible after a description-only build', !registry['copyBtn']._cls.has('d-none') && !registry['optimizeBtn']._cls.has('d-none'));

/* ---- V10.1: the EXISTING "Build Query" button below the tabs ALSO honors the description (same routine) ---- */
registry['promptInput'].value = 'top 3 invoices sorted by gross amount descending';
registry['generateBtn'].dispatch('click');
ok('The pre-existing Build Query button (below the tabs) also builds correctly from a description alone', /Query validated against active schema/i.test(registry['resultBody']._html || ''));
var resultPlainText = stripTags(registry['resultBody']._html || '');
ok('...and correctly applies the "top 3" limit and descending sort derived from the text', /TOP 3|LIMIT 3|FETCH FIRST 3/.test(resultPlainText) && /ORDER BY[\s\S]*DESC/.test(resultPlainText));

/* ---- V10.1: description combined with a pre-existing manual selection merges rather than overrides ---- */
var engineForCheck = APSQL.createEngine(global.window.__AP_SCHEMA__);
var storeForCheck = APSQL_DECODE.createDecodeStore();
var manualCols = [{ table: 'IA_SUPPLIER', column: 'SUPPLIER_CODE' }];
var interp = APSQL_NLQUERY.interpretDescription('show invoice number for invoices', engineForCheck, {});
var mergedTables = APSQL_NLQUERY.mergeTableLists(['IA_SUPPLIER'], interp.tables);
ok('Manual table selection is preserved and combined with a description-derived table (not overridden)', mergedTables.indexOf('IA_SUPPLIER') !== -1 && mergedTables.indexOf('IA_INVOICE') !== -1);
var mergedCols = APSQL_NLQUERY.mergeColumnLists(manualCols, interp.columns);
ok('Manual column selection for IA_SUPPLIER survives the merge untouched', mergedCols.some(function (c) { return c.table === 'IA_SUPPLIER' && c.column === 'SUPPLIER_CODE'; }));
ok('...while the description-derived IA_INVOICE column is also added', mergedCols.some(function (c) { return c.table === 'IA_INVOICE' && c.column === 'INVOICE_NUMBER'; }));

/* ---- V10.1 safety (run FIRST, on a completely fresh CR session with no prior filter state):
   a description can never bypass the mandatory WHERE-condition safety net on its own. ---- */
registry['crDescriptionInput'].value = 'update the invoice status to 40';
registry['crAllowNoWhere'].checked = false;
registry['crGenerateFromDescriptionBtn'].dispatch('click');
ok('A description with no WHERE-style clause still triggers the mandatory WHERE requirement (never silently bypassed)', /A WHERE condition is required/.test(registry['crResultBody']._html || '') || !registry['crWhereRequiredWarning']._cls.has('d-none'));

/* ---- V10.1: Query Builder for CR — description drives the whole Change Request via its own new button ---- */
registry['crDescriptionInput'].value = 'update the invoice status to 40 where invoice id is 123';
registry['crGenerateFromDescriptionBtn'].dispatch('click');
ok('CR description-driven build switches the visual Query Type selector to UPDATE', registry['__qsa_.cr-command-option'].filter(function (o) { return o.getAttribute('data-command') === 'UPDATE'; })[0]._cls.has('active'));
ok('CR description-only build (no manual selection at all) produces a real, successful UPDATE statement', /Query Type: UPDATE/.test(registry['crResultBody']._html || '') && /STATUS = 40/.test(registry['crResultBody']._html || '') && /INVOICE_ID = 123/.test(registry['crResultBody']._html || ''));
ok('The CR "Interpreted from your description" summary box is populated', /Interpreted from your description/i.test(registry['crDescriptionInterpretationBox']._html || ''));

/* ---- Carried forward from V10.0: order-independent multi-table joins + Define Relationship (no regression) ---- */
var threeTableBadOrder = APSQL_ENGINE.buildJoinPlan(engineForCheck, ['IA_INVOICE', 'OM_ORDER', 'IA_SUPPLIER']);
ok('buildJoinPlan resolves a 3-table chain even in a selection order that used to fail (no regression)', threeTableBadOrder.errors.length === 0 && threeTableBadOrder.joins.length === 2);
var relStoreForCheck = APSQL_RELATIONSHIPS.createRelationshipStore();
relStoreForCheck.setManualRelationship('IA_INVOICE', 'COMPANY_ID', 'ADM_USER_DATA', 'USER_ID');
var effEngineForCheck = APSQL_RELATIONSHIPS.createEffectiveEngine(engineForCheck, relStoreForCheck);
var afterMapping = APSQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE', 'ADM_USER_DATA'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }] }, effEngineForCheck, storeForCheck);
ok('"Use for this query" manual relationship mapping still lets a previously-unrelated join succeed (no regression)', afterMapping.status === 'ok');

/* ---- Carried forward from V10.0: data-type-aware Decode end-to-end (no regression) ---- */
var decodeResultOracle = APSQL_ENGINE.generateSql('', { dialect: 'Oracle', selectedTables: ['ADM_USER_DATA'], selectedColumns: [{ table: 'ADM_USER_DATA', column: 'LOGIN_TYPE', alias: 'LOGIN_TYPE', decode: true, elseMode: 'convert' }] }, engineForCheck, storeForCheck);
ok('Data-type-aware Decode (Oracle, convert mode) still produces TO_CHAR in the ELSE branch (no regression)', decodeResultOracle.status === 'ok' && /ELSE TO_CHAR\(ADM_USER_DATA\.LOGIN_TYPE\)/.test(decodeResultOracle.sql));

/* ---- Carried forward from V10.0: Error Rectifier full round trip (no regression) ---- */
registry['errErrorInput'].value = 'ORA-00932: inconsistent datatypes: expected CHAR got NUMBER';
registry['errSqlInput'].value = "SELECT\n    LOGIN_TYPE,\n    CASE\n        WHEN LOGIN_TYPE = 0 THEN 'Forms'\n        ELSE LOGIN_TYPE\n    END AS LOGIN_TYPE\nFROM ADM_USER_DATA;";
registry['errDialectSel'].value = 'Generic';
registry['errRectifyBtn'].dispatch('click');
ok('Error Rectifier still auto-detects Oracle and corrects the ELSE branch (no regression)', registry['errDialectSel'].value === 'Oracle' && /TO_CHAR\(LOGIN_TYPE\)/.test(registry['errRectifiedSqlBody']._html || ''));

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

  var downloadsBeforeDelete = downloadedFiles.length;
  registry['deleteSchemaBtn'].dispatch('click');
  registry['deleteSchemaPasswordInput'].value = 'P@assw0rd';
  registry['confirmDeleteSchemaBtn'].dispatch('click');
  await flushMicrotasks();
  ok('Correct delete password downloads exactly one backup file and empties the schema', downloadedFiles.length === downloadsBeforeDelete + 1 && liveSchemaTableCount() === 0);
  ok('Deleting the schema also clears the description interpretation boxes (clean slate)', registry['descriptionInterpretationBox']._html === '' && registry['crDescriptionInterpretationBox']._html === '');

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
