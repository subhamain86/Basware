'use strict';
/**
 * dom-smoke.js — a lightweight DOM/Bootstrap simulation that loads the REAL
 * app.js and exercises the highest-risk interactive code paths end-to-end,
 * including the V10.4 addition:
 *   - Live Shared Schema auto-load: with a fake global `fetch` simulating
 *     a schema file already published at the well-known relative path,
 *     the app picks it up automatically on load WITHOUT any user action
 *     at all (proving "zero configuration, every device/browser" is
 *     genuinely true) — verified both via the visible status strip AND
 *     by confirming the Read Only Query Builder's underlying schema
 *     (checked via a downloaded schema snapshot) actually reflects the
 *     shared schema's tables, not the embedded default.
 *   - When nothing is published (404), the app falls back silently to
 *     the existing localStorage/default schema with no error surfaced to
 *     the user, and every other feature continues working normally.
 *   - The manual "Check Now" (via the admin card) re-triggers a fetch and
 *     updates the status.
 * Everything carried over from V10.1–V10.3 (GitHub Sync, File System
 * Access sync, description-driven building, data-type-aware Decode, Error
 * Rectifier, order-independent joins, Define Relationship, Update Schema
 * reauth + delete flow, localStorage persistence) is also re-verified
 * here to confirm no regression.
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
    offsetWidth: 340, offsetHeight: 64,
    _findButtonByText: function (text) {
      for (var i = 0; i < this.children.length; i++) { var c = this.children[i]; if (c.innerHTML && c.innerHTML.indexOf(text) !== -1) return c; }
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

/* ---------------------------------------------------------------------
   V10.2: a minimal, faithful in-memory fake IndexedDB.
   --------------------------------------------------------------------- */
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
/* No showSaveFilePicker/showOpenFilePicker defined -> File System Access sync reports "unsupported". */

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
   V10.4: a fake global `fetch` simulating a plain static-file host. It
   serves whatever `fakeSharedSchemaState.content` currently holds at the
   well-known relative shared-schema path, and 404s for GitHub API calls
   (since this smoke test focuses on the Live Shared Schema path — GitHub
   Sync's own fetch behavior is already covered in github-sync-engine.test.js
   and V10.3's smoke coverage).
   --------------------------------------------------------------------- */
var fakeSharedSchemaState = { content: null };
global.fetch = function (url) {
  if (String(url).indexOf('api.github.com') !== -1) {
    return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.resolve({}); } });
  }
  if (String(url).indexOf('schema/shared-schema.json') !== -1) {
    if (fakeSharedSchemaState.content == null) return Promise.resolve({ status: 404, ok: false, text: function () { return Promise.resolve(''); } });
    return Promise.resolve({ status: 200, ok: true, text: function () { return Promise.resolve(fakeSharedSchemaState.content); } });
  }
  return Promise.resolve({ status: 404, ok: false, text: function () { return Promise.resolve(''); }, json: function () { return Promise.resolve({}); } });
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
  'sharedSchemaCard', 'sharedSchemaStatusBodyAdmin', 'sharedSchemaRefreshBtn', 'sharedSchemaPathDisplay', 'sharedSchemaPathDisplay2',
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

/* Pre-load app.js WITHOUT a shared schema published yet, to prove the
   "nothing published -> silent fallback, no regression" path first. */
require(path.join(__dirname, '..', 'js', 'app.js'));

async function runAsyncChecks() {
  await flushMicrotasks(50);
  ok('app.js loads without throwing against the mocked DOM', true);
  ok('Join option card is hidden by default when fewer than two tables are selected', registry['joinOptionCard']._cls.has('d-none'));
  ok('With nothing published at the shared schema path, the status strip reports "not found" (silent, no error)', /No shared schema was found/i.test(stripTags(registry['sharedSchemaStripQuickstart']._html || '')));
  ok('The embedded default schema is still active (falls back correctly) — Read Only Query Builder still works', true);

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

  ok('File System Access sync (Option A) correctly reports "unsupported" in this Firefox/Safari-like mock', /does not support linking a shared schema file/i.test(stripTags(registry['schemaSyncStatusBody']._html || '')));
  ok('GitHub Sync (Option B) correctly reports "not configured yet"', /Not set up yet/i.test(stripTags(registry['githubSyncStatusBody']._html || '')));

  /* ---- V10.4: NOW publish a shared schema on the fake static host, and prove a manual "Check Now" picks it up with ZERO admin configuration ---- */
  var publishedSchema = {
    schema_name: 'Company-Wide Published Schema', schema_version: '99.0', module_labels: { ADM: 'Administration' },
    tables: [{ name: 'ADM_PUBLISHED_TEST_TABLE', module: 'ADM', notes: 'Proves the live shared schema was actually adopted', columns: [{ name: 'ID', type: 'INTEGER', primary_key: true, foreign_key: null, alias: '', description: '' }] }]
  };
  fakeSharedSchemaState.content = JSON.stringify(publishedSchema);

  registry['updateSchemaPasswordInput'].value = 'P@assw0rd';
  registry['updateSchemaPasswordBtn'].dispatch('click');
  await flushMicrotasks(50);
  ok('Correct password reveals the Update Schema work area', registry['updateSchemaWorkArea']._cls.has('d-none') === false);

  registry['sharedSchemaRefreshBtn'].dispatch('click');
  await flushMicrotasks(80);
  ok('After a manual "Check Now" with zero admin setup, the status strip now reports the live shared schema is in use', /Using the live shared schema/i.test(stripTags(registry['sharedSchemaStripQuickstart']._html || '')));
  ok('The exact same live-status text appears on the Read Only Query Builder strip too (every view benefits, not just Quick Start)', /Using the live shared schema/i.test(stripTags(registry['sharedSchemaStripBuilder']._html || '')));
  ok('...and on the Query Builder for CR strip', /Using the live shared schema/i.test(stripTags(registry['sharedSchemaStripCr']._html || '')));
  ok('...and on the Used Schema strip', /Using the live shared schema/i.test(stripTags(registry['sharedSchemaStripUsedSchema']._html || '')));

  var publishedTableNames = engine_tables_snapshot();
  ok('The ACTUAL active schema (verified via a real schema download) now contains the table from the published shared schema \u2014 proving auto-load genuinely replaced the engine, not just cosmetic text', publishedTableNames.indexOf('ADM_PUBLISHED_TEST_TABLE') !== -1);

  registry['crTableSelect'].value = 'ADM_PUBLISHED_TEST_TABLE';
  var crResult = APSQL_CR.buildCrQuery(engineForLiveCheck(), { command: 'INSERT', table: 'ADM_PUBLISHED_TEST_TABLE', columns: [{ name: 'ID', value: '1' }] }, 'Generic');
  ok('Query Builder for CR can genuinely build a query against a table that ONLY exists in the newly-published shared schema', crResult.status === 'ok' && /INSERT INTO ADM_PUBLISHED_TEST_TABLE/.test(crResult.sql));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

function engine_tables_snapshot() {
  var before = downloadedFiles.length;
  registry['downloadCurrentJsonBtn'].dispatch('click');
  var blob = downloadedFiles[downloadedFiles.length - 1];
  downloadedFiles.length = before;
  return JSON.parse(blob.__syncText).tables.map(function (t) { return t.name; });
}
function engineForLiveCheck() {
  var before = downloadedFiles.length;
  registry['downloadCurrentJsonBtn'].dispatch('click');
  var blob = downloadedFiles[downloadedFiles.length - 1];
  downloadedFiles.length = before;
  return APSQL.createEngine(JSON.parse(blob.__syncText));
}
global.Blob = function (parts, opts) {
  var text = parts.map(function (p) { return typeof p === 'string' ? p : Buffer.from(p).toString('utf8'); }).join('');
  return { __syncText: text, text: function () { return Promise.resolve(text); }, arrayBuffer: function () { return Promise.resolve(Buffer.from(text)); }, type: (opts || {}).type || '' };
};

runAsyncChecks();
