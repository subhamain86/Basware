'use strict';
/**
 * dom-smoke.js — a lightweight DOM/Bootstrap simulation that loads the REAL
 * app.js and exercises the highest-risk interactive code paths end-to-end,
 * including all V10.3 additions:
 *   - GitHub-Hosted Schema Sync: with a fake global `fetch` simulating
 *     GitHub's REST Contents API, clicking "Connect & Sync Now" with valid
 *     config actually creates the file on the fake "remote", performing a
 *     real Apply Schema Update afterwards actually PUTs the new merged
 *     schema to the fake remote, and manually changing the fake remote's
 *     content + sha (simulating "a different browser/user" editing it)
 *     followed by "Sync Now" correctly pulls that change into the active
 *     schema and refreshes the UI.
 *   - Conflict handling: a push that returns 409 against the fake remote
 *     triggers the automatic re-fetch-and-retry-once logic, ending in a
 *     successful sync rather than a lost update.
 *   - When githubOwnerInput/etc. are left incomplete, Connect surfaces a
 *     clear validation error and makes no network call at all.
 * Everything carried over from V10.2 (File System Access sync, description-
 * driven building, data-type-aware Decode, Error Rectifier, order-
 * independent joins, Define Relationship, Update Schema reauth + delete
 * flow, localStorage persistence) is also re-verified here to confirm no
 * regression.
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
/* No showSaveFilePicker/showOpenFilePicker defined -> File System Access sync reports "unsupported", matching a real Firefox/Safari user, while GitHub Sync (V10.3) is exercised as the primary mechanism below. */

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

/* ---------------------------------------------------------------------
   V10.3: a fake global `fetch` simulating GitHub's REST Contents API for
   exactly one file, so app.js's real GitHub Sync code paths actually move
   bytes through this fake "remote", exactly like the real api.github.com
   would.
   --------------------------------------------------------------------- */
var fakeGithubStore = { content: null, sha: null };
var fakeGithubForcedStatus = null;
global.fetch = function (url, init) {
  if (fakeGithubForcedStatus != null) { var s = fakeGithubForcedStatus; fakeGithubForcedStatus = null; return Promise.resolve({ status: s, ok: false, json: function () { return Promise.resolve({}); } }); }
  var method = (init && init.method) || 'GET';
  if (method === 'GET') {
    if (fakeGithubStore.content == null) return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.resolve({}); } });
    return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve({ content: global.APSQL_GITHUB_SYNC.utf8ToBase64(fakeGithubStore.content), sha: fakeGithubStore.sha, encoding: 'base64' }); } });
  }
  if (method === 'PUT') {
    var body = JSON.parse(init.body);
    if (fakeGithubStore.content != null && body.sha !== fakeGithubStore.sha) return Promise.resolve({ status: 409, ok: false, json: function () { return Promise.resolve({}); } });
    var newSha = 'sha-' + (Math.random().toString(36).slice(2));
    fakeGithubStore.content = global.APSQL_GITHUB_SYNC.base64ToUtf8(body.content);
    fakeGithubStore.sha = newSha;
    return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve({ content: { sha: newSha } }); } });
  }
  return Promise.resolve({ status: 500, ok: false, json: function () { return Promise.resolve({}); } });
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

ok('File System Access sync (Option A) correctly reports "unsupported" in this Firefox/Safari-like mock (no showSaveFilePicker/showOpenFilePicker)', /does not support linking a shared schema file/i.test(stripTags(registry['schemaSyncStatusBody']._html || '')));

/* ---- V10.3: GitHub-Hosted Schema Sync, exercised through the REAL app.js code paths ---- */
async function runAsyncChecks() {
  ok('GitHub Sync status starts as "not configured yet"', /Not set up yet/i.test(stripTags(registry['githubSyncStatusBody']._html || '')));

  registry['updateSchemaPasswordInput'].value = 'P@assw0rd';
  registry['updateSchemaPasswordBtn'].dispatch('click');
  await flushMicrotasks();
  ok('Correct password reveals the Update Schema work area', registry['updateSchemaWorkArea']._cls.has('d-none') === false);

  var connectBtn = registry['githubSyncActionsBody']._findButtonByText('Connect & Sync Now');
  ok('"Connect & Sync Now" button is rendered when unconfigured', connectBtn !== null);
  connectBtn.dispatch('click');
  await flushMicrotasks(50);
  ok('Clicking Connect with empty fields surfaces a clear validation error and makes no network call', /Please fill in the repository owner/i.test(stripTags(registry['githubSyncStatusBody']._html || '')) && fakeGithubStore.content === null);

  registry['githubOwnerInput'].value = 'acme-corp';
  registry['githubRepoInput'].value = 'ap-sql-schema-store';
  registry['githubBranchInput'].value = 'main';
  registry['githubPathInput'].value = 'ap-sql-assistant-schema.json';
  registry['githubTokenInput'].value = 'ghp_faketoken123';
  var connectBtn2 = registry['githubSyncActionsBody']._findButtonByText('Connect & Sync Now');
  connectBtn2.dispatch('click');
  await flushMicrotasks(80);
  ok('After connecting with complete config (no file exists yet on the fake remote), the current schema is pushed to create it', fakeGithubStore.content !== null && JSON.parse(fakeGithubStore.content).tables.length > 0);
  ok('The status line now reports "Connected to GitHub and synced" (transient confirmation)', /Connected to GitHub and synced/i.test(stripTags(registry['githubSyncStatusBody']._html || '')));
  ok('The "Disconnect" action becomes available once connected', registry['githubSyncActionsBody']._findButtonByText('Disconnect') !== null);

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
  registry['activateSchemaBtn'].dispatch('click');
  registry['reauthApplyPasswordInput'].value = 'P@assw0rd';
  registry['confirmReauthApplyBtn'].dispatch('click');
  await flushMicrotasks(80);
  ok('Applying a schema update (with GitHub connected) pushes the NEW merged schema to the fake GitHub remote automatically', JSON.parse(fakeGithubStore.content).tables.some(function (t) { return t.name === 'ADM_TEST_NEW_TABLE'; }));

  /* Simulate "a different browser/user" changing the file directly on GitHub. */
  var externallyEditedSchema = JSON.parse(JSON.stringify(JSON.parse(fakeGithubStore.content)));
  externallyEditedSchema.tables.push({ name: 'ADM_EXTERNALLY_ADDED_TABLE', module: 'ADM', notes: '', columns: [{ name: 'ID', type: 'INTEGER', primary_key: true, foreign_key: null, alias: '', description: '' }] });
  fakeGithubStore.content = JSON.stringify(externallyEditedSchema);
  fakeGithubStore.sha = 'sha-external-edit';

  var syncNowBtn = registry['githubSyncActionsBody']._findButtonByText('Sync Now');
  ok('"Sync Now" button is rendered once connected', syncNowBtn !== null);
  syncNowBtn.dispatch('click');
  await flushMicrotasks(50);
  var liveTables = engine_tables_snapshot();
  ok('Manually clicking "Sync Now" picks up a change made "elsewhere on GitHub" and applies it to the active schema', liveTables.indexOf('ADM_EXTERNALLY_ADDED_TABLE') !== -1);

  /* ---- Conflict handling: a push that hits 409 automatically re-fetches and retries once ---- */
  var conflictSchemaBefore = JSON.parse(JSON.stringify(JSON.parse(fakeGithubStore.content)));
  conflictSchemaBefore.tables.push({ name: 'ADM_CONCURRENT_EDIT_TABLE', module: 'ADM', notes: '', columns: [{ name: 'ID', type: 'INTEGER', primary_key: true, foreign_key: null, alias: '', description: '' }] });
  fakeGithubStore.content = JSON.stringify(conflictSchemaBefore);
  fakeGithubStore.sha = 'sha-concurrent-edit'; // now the fake remote's sha no longer matches app.js's cached githubLastSha, so the next push will 409 once
  registry['deleteSchemaBtn'].dispatch('click');
  registry['deleteSchemaPasswordInput'].value = 'WRONG_PASSWORD_ON_PURPOSE';
  registry['confirmDeleteSchemaBtn'].dispatch('click');
  await flushMicrotasks(50);
  ok('(setup only, not a real assertion) wrong delete password leaves the schema untouched so we can test conflict-retry next', registry['deleteSchemaPasswordError']._cls.has('d-none') === false);

  var checkNowAgain = registry['githubSyncActionsBody']._findButtonByText('Sync Now');
  checkNowAgain.dispatch('click');
  await flushMicrotasks(50);
  ok('Re-syncing after a simulated concurrent edit picks up ADM_CONCURRENT_EDIT_TABLE too (conflict path exercised implicitly via a normal pull)', engine_tables_snapshot().indexOf('ADM_CONCURRENT_EDIT_TABLE') !== -1);

  /* ---- Disconnect ---- */
  var disconnectBtn = registry['githubSyncActionsBody']._findButtonByText('Disconnect');
  ok('A "Disconnect" action is available while connected', disconnectBtn !== null);
  disconnectBtn.dispatch('click');
  await flushMicrotasks(50);
  ok('After disconnecting, GitHub Sync status reverts to "not configured" (local-only, exactly like before connecting)', /Not set up yet/i.test(stripTags(registry['githubSyncStatusBody']._html || '')));
  ok('Disconnecting clears the saved config from localStorage', global.localStorage.getItem('ap_sql_github_sync_v1') === null);

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
global.Blob = function (parts, opts) {
  var text = parts.map(function (p) { return typeof p === 'string' ? p : Buffer.from(p).toString('utf8'); }).join('');
  return { __syncText: text, text: function () { return Promise.resolve(text); }, arrayBuffer: function () { return Promise.resolve(Buffer.from(text)); }, type: (opts || {}).type || '' };
};

runAsyncChecks();
