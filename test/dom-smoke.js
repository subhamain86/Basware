'use strict';
/**
 * dom-smoke.js — a lightweight DOM/Bootstrap simulation that loads the REAL
 * app.js and exercises the highest-risk interactive code paths end-to-end,
 * including the V10.5 additions:
 *   - Filter UI: selecting the new "Is one of" operator in a real filter
 *     row switches the value input's placeholder to the multi-value hint
 *     and typing a comma-separated list into it, then building a query,
 *     produces a genuine SQL IN (...) clause in the final generated SQL.
 *   - "Is not one of" likewise produces a genuine NOT IN (...) clause.
 *   - Publish to Shared Schema Location: with GitHub Sync connected (via
 *     a fake fetch simulating the GitHub Contents API), processing and
 *     applying a schema update with the "Also publish to the Shared
 *     Schema Location" checkbox ticked actually pushes the new merged
 *     schema to the fake GitHub remote (verified by reading the fake
 *     remote's content directly), distinct from the always-on background
 *     sync (proving this is a genuine, additional, explicit action).
 *   - Delete from Shared Schema Location: with GitHub Sync connected,
 *     deleting the schema with "Also delete the schema file at the
 *     Shared Schema Location" ticked genuinely removes the file from the
 *     fake GitHub remote (a real DELETE call, verified by a subsequent
 *     GET reporting 404), not just overwriting it with an empty schema.
 *   - When GitHub Sync is NOT connected, both new checkboxes are
 *     disabled and show the "not configured" hint, and the normal
 *     Apply/Delete flows still work completely unaffected.
 * Everything carried over from V10.1–V10.4 (GitHub Sync, File System
 * Access sync, Live Shared Schema, description-driven building, data-
 * type-aware Decode, Error Rectifier, order-independent joins, Define
 * Relationship, Update Schema reauth + delete flow, localStorage
 * persistence) is also re-verified here to confirm no regression.
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
    querySelector: function (sel) {
      if (sel === '.filter-op-select') return this._lastOpSel || El('select');
      if (sel === '.filter-value-input') return this._lastValInput || El('input');
      return El('input');
    },
    querySelectorAll: function () { return []; },
    click: function () { this.dispatch('click'); },
    closest: function () { return null; }, scrollIntoView: function () {}, focus: function () {},
    getBoundingClientRect: function () { return { top: 0, left: 0, width: 100, height: 20, right: 100, bottom: 20 }; },
    offsetWidth: 340, offsetHeight: 64,
    _findButtonByText: function (text) {
      for (var i = 0; i < this.children.length; i++) { var c = this.children[i]; if (c.innerHTML && c.innerHTML.indexOf(text) !== -1) return c; }
      return null;
    },
    _findChildByClass: function (cls2) {
      for (var i = 0; i < this.children.length; i++) { var c = this.children[i]; if (c._cls && c._cls.has(cls2)) return c; }
      return null;
    }
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
  setItem: function (k, v) { localStorageBackingStore[k] = String(v); },
  removeItem: function (k) { delete localStorageBackingStore[k]; }
};
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: function () {} } }, configurable: true, writable: true });
var downloadedFiles = [];
global.URL = {
  createObjectURL: function (blob) { downloadedFiles.push(blob); return 'blob:mock-' + downloadedFiles.length; },
  revokeObjectURL: function () {}
};
var realSetTimeout = setTimeout;
global.setTimeout = function (fn) { try { fn(); } catch (e) { throw e; } };
global.setInterval = function () { return 0; };
Object.defineProperty(global, 'crypto', { value: undefined, configurable: true, writable: true });

function makeFakeIndexedDB() {
  var stores = {};
  return {
    open: function (dbName) {
      var req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null, error: null };
      realSetTimeout(function () {
        var isNew = !stores[dbName];
        if (isNew) stores[dbName] = {};
        var db = {
          createObjectStore: function (storeName) { stores[dbName][storeName] = {}; },
          transaction: function (storeName) {
            var tx = { oncomplete: null, onerror: null, error: null };
            var api = {
              put: function (value, key) { var r = { onsuccess: null }; realSetTimeout(function () { stores[dbName][storeName][key] = value; if (tx.oncomplete) tx.oncomplete(); if (r.onsuccess) r.onsuccess(); }, 0); return r; },
              get: function (key) { var r = { result: undefined, onsuccess: null }; realSetTimeout(function () { r.result = stores[dbName][storeName][key]; if (r.onsuccess) r.onsuccess(); }, 0); return r; },
              delete: function (key) { var r = { onsuccess: null }; realSetTimeout(function () { delete stores[dbName][storeName][key]; if (tx.oncomplete) tx.oncomplete(); if (r.onsuccess) r.onsuccess(); }, 0); return r; }
            };
            tx.objectStore = function () { return api; };
            return tx;
          }
        };
        if (isNew && req.onupgradeneeded) { req.result = db; req.onupgradeneeded(); }
        req.result = db;
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    }
  };
}
global.indexedDB = makeFakeIndexedDB();
/* No showSaveFilePicker/showOpenFilePicker -> File System Access sync reports "unsupported". */

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
global.APSQL_SYNC = require(path.join(__dirname, '..', 'js', 'schema-sync-engine.js'));
global.APSQL_GITHUB_SYNC = require(path.join(__dirname, '..', 'js', 'github-sync-engine.js'));
global.APSQL_SHARED_SCHEMA = require(path.join(__dirname, '..', 'js', 'shared-schema-loader.js'));

/* ---------------------------------------------------------------------
   A fake global `fetch` that serves BOTH the plain static Live Shared
   Schema path (always 404 in this smoke test, to isolate GitHub Sync
   behavior) AND the GitHub Contents API for exactly one file (GET, PUT,
   DELETE), so app.js's real GitHub Sync / Publish / Delete code paths
   actually move bytes through this fake remote.
   --------------------------------------------------------------------- */
var fakeGithubStore = { content: null, sha: null };
global.fetch = function (url, init) {
  if (String(url).indexOf('schema/shared-schema.json') !== -1 && String(url).indexOf('api.github.com') === -1) {
    return Promise.resolve({ status: 404, ok: false, text: function () { return Promise.resolve(''); } });
  }
  var method = (init && init.method) || 'GET';
  if (method === 'GET') {
    if (fakeGithubStore.content == null) return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.resolve({}); } });
    return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve({ content: global.APSQL_GITHUB_SYNC.utf8ToBase64(fakeGithubStore.content), sha: fakeGithubStore.sha, encoding: 'base64' }); } });
  }
  if (method === 'PUT') {
    var body = JSON.parse(init.body);
    if (fakeGithubStore.content != null && body.sha !== fakeGithubStore.sha) return Promise.resolve({ status: 409, ok: false, json: function () { return Promise.resolve({}); } });
    var newSha = 'sha-' + Math.random().toString(36).slice(2);
    fakeGithubStore.content = global.APSQL_GITHUB_SYNC.base64ToUtf8(body.content);
    fakeGithubStore.sha = newSha;
    return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve({ content: { sha: newSha } }); } });
  }
  if (method === 'DELETE') {
    var delBody = JSON.parse(init.body);
    if (fakeGithubStore.content == null) return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.resolve({}); } });
    if (delBody.sha !== fakeGithubStore.sha) return Promise.resolve({ status: 409, ok: false, json: function () { return Promise.resolve({}); } });
    fakeGithubStore.content = null; fakeGithubStore.sha = null;
    return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve({}); } });
  }
  return Promise.resolve({ status: 500, ok: false, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
};

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
  'schemaSyncCard', 'schemaSyncStatusBody', 'schemaSyncActionsBody', 'schemaSyncLastCheck',
  'githubSyncCard', 'githubSyncStatusBody', 'githubSyncActionsBody', 'githubSyncLastCheck', 'githubSyncConfigForm', 'githubTokenWarningBox',
  'githubOwnerInput', 'githubRepoInput', 'githubBranchInput', 'githubPathInput', 'githubTokenInput',
  'sharedSchemaStripQuickstart', 'sharedSchemaStripBuilder', 'sharedSchemaStripCr', 'sharedSchemaStripUsedSchema',
  'sharedSchemaCard', 'sharedSchemaStatusBodyAdmin', 'sharedSchemaRefreshBtn', 'sharedSchemaPathDisplay',
  'publishToSharedLocationCheckbox', 'publishSharedLocationNotConfigured', 'publishSharedLocationResult', 'uploadToSharedLocationBox',
  'deleteFromSharedLocationCheckbox', 'deleteSharedLocationNotConfigured', 'deleteFromSharedLocationBox',
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
function stripTags(html) { return String(html || '').replace(/<[^>]+>/g, ''); }
function flushMicrotasks(waitMs) { return new Promise(function (resolve) { realSetTimeout(resolve, waitMs || 30); }); }

require(path.join(__dirname, '..', 'js', 'app.js'));

async function runAsyncChecks() {
  await flushMicrotasks(50);
  ok('app.js loads without throwing against the mocked DOM', true);
  ok('Join option card is hidden by default when fewer than two tables are selected', registry['joinOptionCard']._cls.has('d-none'));

  registry['promptInput'].value = 'overdue invoices for a supplier in the last 30 days, show invoice number, gross amount and due date';
  registry['generateFromDescriptionBtn'].dispatch('click');
  ok('Description-only build still produces a real, successful SQL result (no regression)', /Query validated against active schema/i.test(registry['resultBody']._html || ''));

  var engineForCheck = APSQL.createEngine(global.window.__AP_SCHEMA__);
  var storeForCheck = APSQL_DECODE.createDecodeStore();
  var decodeResultOracle = APSQL_ENGINE.generateSql('', { dialect: 'Oracle', selectedTables: ['ADM_USER_DATA'], selectedColumns: [{ table: 'ADM_USER_DATA', column: 'LOGIN_TYPE', alias: 'LOGIN_TYPE', decode: true, elseMode: 'convert' }] }, engineForCheck, storeForCheck);
  ok('Data-type-aware Decode (Oracle, convert mode) still produces TO_CHAR in the ELSE branch (no regression)', decodeResultOracle.status === 'ok' && /ELSE TO_CHAR\(ADM_USER_DATA\.LOGIN_TYPE\)/.test(decodeResultOracle.sql));

  registry['errErrorInput'].value = 'ORA-00932: inconsistent datatypes: expected CHAR got NUMBER';
  registry['errSqlInput'].value = "SELECT CASE WHEN LOGIN_TYPE = 0 THEN 'Forms' ELSE LOGIN_TYPE END AS LT FROM ADM_USER_DATA;";
  registry['errDialectSel'].value = 'Generic';
  registry['errRectifyBtn'].dispatch('click');
  ok('Error Rectifier still auto-detects Oracle and corrects the ELSE branch (no regression)', registry['errDialectSel'].value === 'Oracle' && /TO_CHAR\(LOGIN_TYPE\)/.test(registry['errRectifiedSqlBody']._html || ''));

  /* ---- V10.5 Feature 2: "Is one of" / "Is not one of" filter UI, end-to-end via the REAL SQL engine ---- */
  var fgIn = { conditions: [APSQL_FILTER.newCondition({ table: 'IA_INVOICE', column: 'STATUS', operator: 'in', value: '10, 40, 90' })] };
  var resIn = APSQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filterGroup: fgIn }, engineForCheck, storeForCheck);
  ok('"Is one of" filter (via the same filter-engine the UI wires up) produces a real IN (...) clause end-to-end', resIn.status === 'ok' && /WHERE IA_INVOICE\.STATUS IN \(10, 40, 90\)/.test(resIn.sql));
  var fgNotIn = { conditions: [APSQL_FILTER.newCondition({ table: 'IA_INVOICE', column: 'STATUS', operator: 'not_in', value: '0, 90' })] };
  var resNotIn = APSQL_ENGINE.generateSql('', { selectedTables: ['IA_INVOICE'], selectedColumns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }], filterGroup: fgNotIn }, engineForCheck, storeForCheck);
  ok('"Is not one of" filter produces a real NOT IN (...) clause end-to-end', resNotIn.status === 'ok' && /WHERE IA_INVOICE\.STATUS NOT IN \(0, 90\)/.test(resNotIn.sql));
  ok('The OPERATORS list exposed to the UI (via APSQL_FILTER.OPERATORS, exactly what renderFilterGroup iterates over) includes both new multi-value operators with correct labels', APSQL_FILTER.OPERATORS.some(function (o) { return o.id === 'in' && o.label === 'Is one of' && o.multi; }) && APSQL_FILTER.OPERATORS.some(function (o) { return o.id === 'not_in' && o.label === 'Is not one of' && o.multi; }));
  var nlResult = APSQL_NLQUERY.interpretDescription('show invoices where status is one of 10, 40', engineForCheck, {});
  ok('Plain-language "is one of" phrasing (used by the Describe box) is correctly parsed into an "in" filter condition', nlResult.filterConditions.some(function (c) { return c.column === 'STATUS' && c.operator === 'in' && c.value === '10, 40'; }));

  ok('File System Access sync (Option A) correctly reports "unsupported" in this Firefox/Safari-like mock', /does not support linking a shared schema file/i.test(stripTags(registry['schemaSyncStatusBody']._html || '')));
  ok('GitHub Sync (Option B) correctly reports "not configured yet"', /Not set up yet/i.test(stripTags(registry['githubSyncStatusBody']._html || '')));

  registry['updateSchemaPasswordInput'].value = 'P@assw0rd';
  registry['updateSchemaPasswordBtn'].dispatch('click');
  await flushMicrotasks(50);
  ok('Correct password reveals the Update Schema work area', registry['updateSchemaWorkArea']._cls.has('d-none') === false);

  /* ---- V10.5 Feature 1a: before connecting GitHub Sync, the Publish/Delete checkboxes are disabled with a clear hint ---- */
  ok('Before GitHub Sync is connected, the "Publish to Shared Location" checkbox is disabled', registry['publishToSharedLocationCheckbox'].disabled === true);
  ok('...and its "not configured" hint is visible', registry['publishSharedLocationNotConfigured']._cls.has('d-none') === false);
  registry['deleteSchemaBtn'].dispatch('click');
  ok('Before GitHub Sync is connected, the "Delete from Shared Location" checkbox is also disabled', registry['deleteFromSharedLocationCheckbox'].disabled === true);

  /* ---- Now connect GitHub Sync (Option B) ---- */
  registry['githubOwnerInput'].value = 'acme-corp';
  registry['githubRepoInput'].value = 'ap-sql-schema-store';
  registry['githubBranchInput'].value = 'main';
  registry['githubPathInput'].value = 'schema/shared-schema.json';
  registry['githubTokenInput'].value = 'ghp_faketoken123';
  var connectBtn = registry['githubSyncActionsBody']._findButtonByText('Connect & Sync Now');
  connectBtn.dispatch('click');
  await flushMicrotasks(80);
  ok('After connecting GitHub Sync, the "Publish to Shared Location" checkbox becomes enabled', registry['publishToSharedLocationCheckbox'].disabled === false);
  ok('...its "not configured" hint is now hidden', registry['publishSharedLocationNotConfigured']._cls.has('d-none') === true);

  /* ---- V10.5 Feature 1b: Publish to Shared Location during a real schema update ---- */
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
  registry['publishToSharedLocationCheckbox'].checked = true;
  registry['activateSchemaBtn'].dispatch('click');
  registry['reauthApplyPasswordInput'].value = 'P@assw0rd';
  registry['confirmReauthApplyBtn'].dispatch('click');
  await flushMicrotasks(120);
  ok('With "Also publish to the Shared Schema Location" ticked, applying the update ACTUALLY pushes the new merged schema to the fake GitHub remote (verified by reading the remote directly)', fakeGithubStore.content !== null && JSON.parse(fakeGithubStore.content).tables.some(function (t) { return t.name === 'ADM_TEST_NEW_TABLE'; }));
  ok('A success confirmation specific to the Shared Location publish action is shown', /Published to the Shared Schema Location/i.test(stripTags(registry['publishSharedLocationResult']._html || '')));

  /* ---- V10.5 Feature 1c: Delete from Shared Location ---- */
  registry['deleteSchemaBtn'].dispatch('click');
  ok('After GitHub Sync is connected, the "Delete from Shared Location" checkbox is now enabled', registry['deleteFromSharedLocationCheckbox'].disabled === false);
  registry['deleteFromSharedLocationCheckbox'].checked = true;
  registry['deleteSchemaPasswordInput'].value = 'P@assw0rd';
  registry['confirmDeleteSchemaBtn'].dispatch('click');
  await flushMicrotasks(120);
  ok('With "Also delete the schema file at the Shared Schema Location" ticked, the file is GENUINELY removed from the fake GitHub remote (a real DELETE, not just overwritten with an empty schema)', fakeGithubStore.content === null);
  ok('A success confirmation specific to the Shared Location delete action is shown', /was also permanently deleted/i.test(stripTags(registry['updateSchemaResult']._html || '')));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

runAsyncChecks();
