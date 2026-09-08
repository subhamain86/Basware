(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  var SCHEMA_STORAGE_KEY = 'ap_sql_active_schema_v1';
  function loadInitialSchema() {
    try {
      var raw = localStorage.getItem(SCHEMA_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.tables)) {
          var validation = window.APSQL_SCHEMA_TOOLS.validateSchema(parsed.tables);
          if (validation.valid) return { schema: parsed, fromStorage: true };
        }
      }
    } catch (e) { }
    return { schema: window.__AP_SCHEMA__, fromStorage: false };
  }
  var initialSchemaLoad = loadInitialSchema();
  var currentSchema = initialSchemaLoad.schema;
  var schemaLoadedFromStorage = initialSchemaLoad.fromStorage;

  var relationshipStore = APSQL_RELATIONSHIPS.createRelationshipStore();
  var engine;
  function rebuildEngine() { engine = APSQL_RELATIONSHIPS.createEffectiveEngine(APSQL.createEngine(currentSchema), relationshipStore); }
  rebuildEngine();
  var decodeStore = APSQL_DECODE.createDecodeStore();

  var syncSupported = APSQL_SYNC.isFileSystemAccessSupported(window);
  var syncHandleStore = syncSupported ? APSQL_SYNC.createHandleStore() : null;
  var linkedHandle = null;
  var linkedFileName = null;
  var lastKnownFileModified = null;
  var syncNeedsReconnect = false;
  var syncError = null;
  var syncLastCheckedAt = null;
  var pendingSaveRelationshipDraft = null;

  function currentSyncState() {
    return { supported: syncSupported, linked: !!linkedHandle, fileName: linkedFileName, needsReconnect: syncNeedsReconnect, error: syncError };
  }
  function renderSyncStatus(transientNote) {
    var statusBody = $('schemaSyncStatusBody');
    var actionsBody = $('schemaSyncActionsBody');
    var lastCheckEl = $('schemaSyncLastCheck');
    if (!statusBody || !actionsBody) return;
    var status = APSQL_SYNC.describeSyncStatus(currentSyncState());
    statusBody.innerHTML = '<div class="schema-sync-status-line level-' + status.level + '">' +
      (status.level === 'linked' ? '<span class="schema-sync-pulse"></span>' : '<i class="bi ' + (status.level === 'unsupported' ? 'bi-info-circle' : status.level === 'error' ? 'bi-exclamation-triangle-fill' : status.level === 'reconnect' ? 'bi-plug-fill' : 'bi-cloud-slash') + '"></i>') +
      '<span>' + esc(transientNote || status.text) + '</span></div>';
    actionsBody.innerHTML = '';
    if (!syncSupported) { lastCheckEl.textContent = ''; return; }
    function addBtn(label, iconClass, cls, handler) {
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-sm ' + cls;
      btn.innerHTML = '<i class="bi ' + iconClass + ' me-1"></i>' + label;
      btn.addEventListener('click', handler);
      actionsBody.appendChild(btn);
    }
    if (syncNeedsReconnect) {
      addBtn('Reconnect to Shared File', 'bi-plug-fill', 'btn-outline-warning', reconnectSharedFile);
      addBtn('Unlink', 'bi-x-circle', 'btn-outline-secondary', unlinkSharedFile);
    } else if (linkedHandle) {
      addBtn('Check Now', 'bi-arrow-clockwise', 'btn-outline-primary', function () { checkLinkedFileForUpdates(true); });
      addBtn('Unlink', 'bi-x-circle', 'btn-outline-secondary', unlinkSharedFile);
    } else {
      addBtn('Create New Shared File', 'bi-file-earmark-plus', 'btn-outline-success', linkNewSharedFile);
      addBtn('Link Existing Shared File', 'bi-folder2-open', 'btn-outline-primary', linkExistingSharedFile);
    }
    lastCheckEl.textContent = syncLastCheckedAt ? ('Last checked: ' + syncLastCheckedAt.toLocaleTimeString()) : '';
  }

  function checkLinkedFileForUpdates(isManualCheck) {
    if (!linkedHandle) return Promise.resolve();
    return APSQL_SYNC.verifyPermissionSilent(linkedHandle, 'read').then(function (granted) {
      if (!granted) { syncNeedsReconnect = true; renderSyncStatus(); return; }
      syncNeedsReconnect = false;
      return APSQL_SYNC.readSchemaFromHandle(linkedHandle).then(function (result) {
        syncLastCheckedAt = new Date();
        if (lastKnownFileModified !== null && result.lastModified === lastKnownFileModified) { syncError = null; renderSyncStatus(); return; }
        var tablesToValidate = Array.isArray(result.schema) ? result.schema : result.schema.tables;
        var validation = window.APSQL_SCHEMA_TOOLS.validateSchema(tablesToValidate);
        if (!validation.valid) { renderSyncStatus(); return; }
        currentSchema = result.schema; rebuildEngine();
        lastKnownFileModified = result.lastModified;
        try { localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(currentSchema)); } catch (e) { }
        schemaLoadedFromStorage = true;
        refreshAllViewsAfterSchemaChange();
        renderSchemaPersistenceStatus();
        syncError = null;
        renderSyncStatus(isManualCheck ? 'Checked the shared file just now.' : 'Schema synced from the shared file (it was updated elsewhere).');
      });
    }).catch(function (err) { if (isManualCheck) { syncError = 'Could not check the shared file: ' + err.message; renderSyncStatus(); } });
  }
  function syncWriteCurrentSchemaIfLinked() {
    if (!linkedHandle) return;
    APSQL_SYNC.verifyPermissionSilent(linkedHandle, 'readwrite').then(function (granted) {
      if (!granted) { syncNeedsReconnect = true; renderSyncStatus(); return; }
      return APSQL_SYNC.writeSchemaToHandle(linkedHandle, currentSchema).then(function () {
        return APSQL_SYNC.readSchemaFromHandle(linkedHandle).then(function (result) { lastKnownFileModified = result.lastModified; });
      }).then(function () { syncError = null; renderSyncStatus(); });
    }).catch(function (err) { syncError = 'Could not write to the linked shared file: ' + err.message; renderSyncStatus(); });
  }
  function linkNewSharedFile() {
    if (!window.showSaveFilePicker) return;
    window.showSaveFilePicker({ suggestedName: 'ap-sql-assistant-schema.json', types: [{ description: 'AP-SQL Assistant Schema', accept: { 'application/json': ['.json'] } }] })
      .then(function (handle) {
        linkedHandle = handle; linkedFileName = handle.name; syncNeedsReconnect = false;
        return APSQL_SYNC.writeSchemaToHandle(handle, currentSchema)
          .then(function () { return APSQL_SYNC.readSchemaFromHandle(handle); })
          .then(function (result) { lastKnownFileModified = result.lastModified; return syncHandleStore.saveHandle(handle); });
      })
      .then(function () { syncError = null; syncLastCheckedAt = new Date(); renderSyncStatus('Created and linked the shared schema file.'); })
      .catch(function (err) { if (err && err.name === 'AbortError') return; syncError = 'Could not create the shared schema file: ' + err.message; renderSyncStatus(); });
  }
  function linkExistingSharedFile() {
    if (!window.showOpenFilePicker) return;
    window.showOpenFilePicker({ types: [{ description: 'AP-SQL Assistant Schema', accept: { 'application/json': ['.json'] } }] })
      .then(function (handles) {
        var handle = handles[0];
        return APSQL_SYNC.verifyPermission(handle, 'readwrite').then(function (granted) {
          if (!granted) throw new Error('Permission to read/write this file was not granted.');
          return APSQL_SYNC.readSchemaFromHandle(handle).then(function (result) {
            var tablesToValidate = Array.isArray(result.schema) ? result.schema : result.schema.tables;
            var validation = window.APSQL_SCHEMA_TOOLS.validateSchema(tablesToValidate);
            if (!validation.valid) throw new Error('That file does not contain a valid AP-SQL Assistant schema.');
            linkedHandle = handle; linkedFileName = handle.name; syncNeedsReconnect = false;
            currentSchema = result.schema; rebuildEngine();
            lastKnownFileModified = result.lastModified;
            try { localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(currentSchema)); } catch (e) { }
            schemaLoadedFromStorage = true;
            return syncHandleStore.saveHandle(handle);
          });
        });
      })
      .then(function () { syncError = null; syncLastCheckedAt = new Date(); refreshAllViewsAfterSchemaChange(); renderSchemaPersistenceStatus(); renderSyncStatus('Linked to the existing shared schema file.'); })
      .catch(function (err) { if (err && err.name === 'AbortError') return; syncError = 'Could not link that shared schema file: ' + err.message; renderSyncStatus(); });
  }
  function unlinkSharedFile() {
    linkedHandle = null; linkedFileName = null; lastKnownFileModified = null; syncError = null; syncNeedsReconnect = false; syncLastCheckedAt = null;
    (syncHandleStore ? syncHandleStore.clearHandle() : Promise.resolve()).then(function () { renderSyncStatus(); }).catch(function () { renderSyncStatus(); });
  }
  function reconnectSharedFile() {
    if (!linkedHandle) return;
    APSQL_SYNC.verifyPermission(linkedHandle, 'readwrite').then(function (granted) {
      if (!granted) { syncError = 'Permission was not granted, so syncing remains paused for this file.'; renderSyncStatus(); return; }
      syncNeedsReconnect = false; syncError = null;
      return checkLinkedFileForUpdates(true);
    }).catch(function (err) { syncError = 'Could not reconnect: ' + err.message; renderSyncStatus(); });
  }
  if (syncSupported && syncHandleStore) {
    syncHandleStore.loadHandle().then(function (handle) {
      if (!handle) { renderSyncStatus(); return; }
      linkedHandle = handle; linkedFileName = handle.name;
      return APSQL_SYNC.verifyPermissionSilent(handle, 'read').then(function (granted) {
        if (!granted) { syncNeedsReconnect = true; renderSyncStatus(); return; }
        return checkLinkedFileForUpdates(false).then(function () { renderSyncStatus(); });
      });
    }).catch(function () { renderSyncStatus(); });
    setInterval(function () { if (typeof document.hidden === 'undefined' || !document.hidden) checkLinkedFileForUpdates(false); }, 20000);
    if (typeof document.addEventListener === 'function') document.addEventListener('visibilitychange', function () { if (!document.hidden) checkLinkedFileForUpdates(false); });
  } else {
    renderSyncStatus();
  }

  function persistCurrentSchema() {
    try { localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(currentSchema)); } catch (e) { }
    syncWriteCurrentSchemaIfLinked();
  }
  function renderSchemaPersistenceStatus() {
    var el = $('schemaPersistenceStatus'); if (!el) return;
    el.innerHTML = schemaLoadedFromStorage
      ? '<i class="bi bi-hdd-fill"></i><span>This schema was loaded from a previous update saved in this browser. It will remain active even after refreshing or reopening this page in the same browser.</span>'
      : '<i class="bi bi-box-seam"></i><span>Using the embedded default schema (no saved changes found in this browser yet). Applying an update or deleting the schema will be saved automatically from now on.</span>';
  }
  renderSchemaPersistenceStatus();

  function moduleLabels() { return engine.getModuleLabels(); }
  function allTables() { return engine.getAllTables().slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }); }

  function syncNavbarOffset() {
    var navbar = $('mainNavbar');
    if (!navbar) return;
    document.documentElement.style.setProperty('--navbar-h', navbar.offsetHeight + 'px');
  }
  syncNavbarOffset();
  window.addEventListener('resize', syncNavbarOffset);
  window.addEventListener('load', syncNavbarOffset);

  var THEME_KEY = 'ap_sql_theme';
  function systemPrefersDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function applyTheme(choice) { document.documentElement.setAttribute('data-bs-theme', choice === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : choice); }
  function setTheme(choice) { try { localStorage.setItem(THEME_KEY, choice); } catch (e) {} applyTheme(choice); }
  (function initTheme() {
    var saved = 'auto';
    try { saved = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
    applyTheme(saved);
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      var current = 'auto'; try { current = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
      if (current === 'auto') applyTheme('auto');
    });
  })();
  document.querySelectorAll('[data-theme]').forEach(function (btn) { btn.addEventListener('click', function () { setTheme(btn.getAttribute('data-theme')); }); });

  var offcanvasEl = $('mainMenu');
  var offcanvasInstance = window.bootstrap ? new window.bootstrap.Offcanvas(offcanvasEl) : null;
  function closeMenu() { if (offcanvasInstance) offcanvasInstance.hide(); }
  var currentView = 'quickstart';
  function showView(view) {
    document.querySelectorAll('.offcanvas-body > button.nav-link, .menu-submenu .nav-link').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    document.querySelectorAll('.app-view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
    window.scrollTo(0, 0);
    currentView = view;
    if (view === 'usedschema') renderUsedSchema();
  }
  document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { showView(b.getAttribute('data-view')); closeMenu(); }); });
  function makeCollapsible(toggleId, submenuId) {
    var toggle = $(toggleId), submenu = $(submenuId);
    toggle.addEventListener('click', function () { toggle.classList.toggle('open'); submenu.classList.toggle('open'); });
  }
  makeCollapsible('queryBuilderMenuToggle', 'queryBuilderSubmenu');
  makeCollapsible('schemaMenuToggle', 'schemaSubmenu');
  makeCollapsible('themeMenuToggle', 'themeSubmenu');

  document.querySelectorAll('#manualTabs .nav-link').forEach(function (t) {
    t.addEventListener('click', function () {
      var name = t.getAttribute('data-tab');
      document.querySelectorAll('#manualTabs .nav-link').forEach(function (x) { x.classList.toggle('active', x === t); });
      document.querySelectorAll('.tab-pane-manual').forEach(function (p) { var show = p.id === 'pane-' + name; p.classList.toggle('d-none', !show); p.classList.toggle('active', show); });
      if (name === 'requirements') renderRequirementsSummary();
    });
  });

  var QS_BADGE_COLORS = ['badge-teal', 'badge-indigo', 'badge-orange', 'badge-purple', 'badge-pink', 'badge-blue'];
  var QUICK_EXAMPLES = [
    { ic: '&#128196;', title: 'Invoice overview', desc: 'Key invoice fields at a glance.', tables: ['IA_INVOICE'], columns: [{ table: 'IA_INVOICE', column: 'INVOICE_NUMBER' }, { table: 'IA_INVOICE', column: 'GROSS_SUM' }, { table: 'IA_INVOICE', column: 'DUE_DATE' }] },
    { ic: '&#128176;', title: 'Invoices by status', desc: 'Grouped totals — a good starting point for a spend report.', tables: ['IA_INVOICE'], columns: [{ table: 'IA_INVOICE', column: 'STATUS', decode: true, alias: 'StatusLabel' }] },
    { ic: '&#129513;', title: 'Invoice coding detail', desc: 'Accounting split lines with cost centers.', tables: ['IA_INVOICE_LINE'], columns: [{ table: 'IA_INVOICE_LINE', column: 'ACCOUNT_CODE' }, { table: 'IA_INVOICE_LINE', column: 'COST_CENTER_CODE' }, { table: 'IA_INVOICE_LINE', column: 'NET_SUM' }] },
    { ic: '&#128100;', title: 'Users and login types', desc: 'Full name, email, and a data-type-safe decoded login type.', tables: ['ADM_USER_DATA'], columns: [{ table: 'ADM_USER_DATA', column: 'FULL_NAME' }, { table: 'ADM_USER_DATA', column: 'EMAIL' }, { table: 'ADM_USER_DATA', column: 'LOGIN_TYPE', decode: true, alias: 'LoginType' }] },
    { ic: '&#127760;', title: 'Supervisor chain (recursive)', desc: 'Walk the whole reporting hierarchy in one query.', hierarchy: 'ADM_USER_DATA' }
  ];
  (function initQuickStart() {
    var grid = $('qsExampleGrid');
    grid.innerHTML = QUICK_EXAMPLES.map(function (q, i) {
      return '<div class="col"><div class="card qs-example-card h-100" data-i="' + i + '"><div class="card-body"><div class="qs-icon-badge ' + QS_BADGE_COLORS[i % QS_BADGE_COLORS.length] + ' mb-2">' + q.ic + '</div><h3 class="h6">' + esc(q.title) + '</h3><p class="text-body-secondary small mb-0">' + esc(q.desc) + '</p></div></div></div>';
    }).join('');
    grid.querySelectorAll('.qs-example-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var q = QUICK_EXAMPLES[+card.getAttribute('data-i')];
        showView('builder');
        if (q.hierarchy) { $('optHierarchy').value = q.hierarchy; selectedTables = [q.hierarchy]; columnState = {}; refreshTablesColumnsUI(); }
        else { $('optHierarchy').value = ''; selectedTables = q.tables.slice(); columnState = {}; q.columns.forEach(function (c) { ensureColState(c.table)[c.column] = { checked: true, alias: c.alias || '', decode: !!c.decode, elseMode: 'convert' }; }); refreshTablesColumnsUI(); }
        runGenerate();
      });
    });
    refreshModuleChips();
  })();
  function refreshModuleChips() {
    var counts = {};
    allTables().forEach(function (t) { counts[t.module] = (counts[t.module] || 0) + 1; });
    var labels = moduleLabels();
    $('qsModuleChips').innerHTML = Object.keys(counts).sort().map(function (m) { return '<span class="badge text-bg-light border module-chip">' + esc(labels[m] || m) + ' &middot; ' + counts[m] + '</span>'; }).join('');
  }

  var selectedTables = [];
  var columnState = {};
  function refreshModuleDropdown() {
    var sel = $('moduleFilterSel'); var labels = moduleLabels(); var counts = {};
    allTables().forEach(function (t) { counts[t.module] = (counts[t.module] || 0) + 1; });
    sel.innerHTML = '<option value="">Select Module &#9662;</option>' + Object.keys(counts).sort().map(function (m) { return '<option value="' + m + '">' + esc(labels[m] || m) + ' (' + counts[m] + ')</option>'; }).join('');
  }
  function renderTableList() {
    var moduleFilter = $('moduleFilterSel').value; var searchFilter = ($('tableSearchInput').value || '').toLowerCase();
    var grid = $('tableListGrid'); grid.innerHTML = '';
    allTables().forEach(function (t) {
      if (moduleFilter && t.module !== moduleFilter) return;
      if (searchFilter && (t.name + ' ' + (t.notes || '')).toLowerCase().indexOf(searchFilter) === -1) return;
      var col = document.createElement('div'); col.className = 'col';
      var checked = selectedTables.indexOf(t.name) !== -1;
      col.innerHTML = '<div class="form-check"><input class="form-check-input" type="checkbox" id="tbl_' + t.name + '" ' + (checked ? 'checked' : '') + '><label class="form-check-label small" for="tbl_' + t.name + '"><code>' + t.name + '</code> <span class="text-body-secondary">(' + t.module + ')</span></label></div>';
      col.querySelector('input').addEventListener('change', function (e) { toggleTable(t.name, e.target.checked); });
      grid.appendChild(col);
    });
  }
  function visibleTableNames() {
    var moduleFilter = $('moduleFilterSel').value; var searchFilter = ($('tableSearchInput').value || '').toLowerCase();
    return allTables().filter(function (t) { if (moduleFilter && t.module !== moduleFilter) return false; if (searchFilter && (t.name + ' ' + (t.notes || '')).toLowerCase().indexOf(searchFilter) === -1) return false; return true; }).map(function (t) { return t.name; });
  }
  function toggleTable(name, on) {
    var idx = selectedTables.indexOf(name);
    if (on && idx === -1) selectedTables.push(name);
    if (!on && idx !== -1) { selectedTables.splice(idx, 1); delete columnState[name]; }
    refreshTableSelCount(); refreshSelectedTableDropdown(); renderColumnList(); refreshFilterColumnOptions();
    renderJoinPreview(); renderSortRows();
  }
  function refreshTableSelCount() { $('tableSelCount').textContent = selectedTables.length + ' table' + (selectedTables.length === 1 ? '' : 's') + ' selected'; }
  $('moduleFilterSel').addEventListener('change', renderTableList);
  $('tableSearchInput').addEventListener('input', renderTableList);
  $('tableSelectAllBtn').addEventListener('click', function () { visibleTableNames().forEach(function (n) { if (selectedTables.indexOf(n) === -1) selectedTables.push(n); }); refreshTableSelCount(); refreshSelectedTableDropdown(); renderTableList(); renderColumnList(); refreshFilterColumnOptions(); renderJoinPreview(); renderSortRows(); });
  $('tableUnselectAllBtn').addEventListener('click', function () { selectedTables = []; columnState = {}; refreshTableSelCount(); refreshSelectedTableDropdown(); renderTableList(); renderColumnList(); refreshFilterColumnOptions(); renderJoinPreview(); renderSortRows(); });
  function refreshSelectedTableDropdown() {
    var sel = $('selectedTableDropdown'); var current = sel.value;
    sel.innerHTML = '<option value="">Selected Table &#9662;</option>' + selectedTables.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
    if (selectedTables.indexOf(current) !== -1) sel.value = current; else if (selectedTables.length) sel.value = selectedTables[0];
  }
  $('selectedTableDropdown').addEventListener('change', renderColumnList);
  function ensureColState(tname) { if (!columnState[tname]) columnState[tname] = {}; return columnState[tname]; }

  function buildDecodeInlineEditor(tname, col, decodeCb, panelParent) {
    var wrap = document.createElement('span'); wrap.className = 'd-inline-flex align-items-center gap-1';
    var badge = document.createElement('span'); badge.className = 'badge text-bg-light border decode-source-badge d-none';
    var toggleBtn = document.createElement('button'); toggleBtn.type = 'button'; toggleBtn.className = 'btn btn-link btn-sm p-0 small';
    var panel = null;
    function syncLabel() {
      var resolved = APSQL_DECODE.resolveDecode(engine, decodeStore, tname, col.name);
      if (resolved.source === 'schema') { badge.textContent = 'Schema Defined'; badge.classList.remove('d-none'); toggleBtn.classList.add('d-none'); decodeCb.disabled = !decodeCb._rowChecked; }
      else if (resolved.source === 'user') { badge.textContent = 'User Defined'; badge.classList.remove('d-none'); toggleBtn.textContent = 'Edit Decode'; toggleBtn.classList.remove('d-none'); decodeCb.disabled = !decodeCb._rowChecked; }
      else { badge.classList.add('d-none'); toggleBtn.textContent = '+ Add Decode'; toggleBtn.classList.remove('d-none'); decodeCb.disabled = true; }
    }
    toggleBtn.addEventListener('click', function (ev) { ev.stopPropagation(); if (!panel) { panel = openManualDecodeEditor(tname, col.name, syncLabel); (panelParent || wrap).appendChild(panel); } else panel.classList.toggle('d-none'); });
    wrap.appendChild(badge); wrap.appendChild(toggleBtn); syncLabel(); wrap._syncLabel = syncLabel;
    return wrap;
  }
  function openManualDecodeEditor(tname, colName, onValuesChanged) {
    var existing = decodeStore.getManualDecode(tname, colName) || [];
    var container = document.createElement('div'); container.className = 'decode-editor-box mt-2';
    function render() {
      container.innerHTML = '<div class="fw-semibold small mb-2">Manual decode for ' + esc(colName) + '</div>';
      var list = document.createElement('div');
      existing.forEach(function (pair, idx) {
        var row = document.createElement('div'); row.className = 'decode-value-row';
        row.innerHTML = '<input class="form-control form-control-sm dv-code" placeholder="Stored Value" value="' + esc(pair.code) + '"><input class="form-control form-control-sm dv-label" placeholder="Display Value" value="' + esc(pair.label) + '"><button class="btn btn-outline-danger btn-sm" type="button">&times;</button>';
        row.querySelector('.dv-code').addEventListener('input', function (e) { existing[idx].code = e.target.value; decodeStore.setManualDecode(tname, colName, existing); });
        row.querySelector('.dv-label').addEventListener('input', function (e) { existing[idx].label = e.target.value; decodeStore.setManualDecode(tname, colName, existing); });
        row.querySelector('button').addEventListener('click', function () { existing.splice(idx, 1); decodeStore.setManualDecode(tname, colName, existing); render(); if (onValuesChanged) onValuesChanged(); });
        list.appendChild(row);
      });
      container.appendChild(list);
      var addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'btn btn-outline-primary btn-sm mt-1'; addBtn.textContent = '+ Add Value';
      addBtn.addEventListener('click', function () { existing.push({ code: '', label: '' }); decodeStore.setManualDecode(tname, colName, existing); render(); if (onValuesChanged) onValuesChanged(); });
      container.appendChild(addBtn);
      var clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.className = 'btn btn-outline-secondary btn-sm mt-1 ms-2'; clearBtn.textContent = 'Clear manually added values';
      clearBtn.addEventListener('click', function () { existing = []; decodeStore.clearManualDecode(tname, colName); render(); if (onValuesChanged) onValuesChanged(); });
      container.appendChild(clearBtn);
    }
    render(); container.classList.add('d-none');
    return container;
  }

  function buildDataTypeElseModePanel(tname, colName, state) {
    var box = document.createElement('div'); box.className = 'decode-datatype-box';
    var schemaCol = engine.getColumn(tname, colName);
    var dataType = schemaCol ? schemaCol.type : null;
    if (!dataType) {
      box.innerHTML = '<span class="decode-datatype-unavailable"><i class="bi bi-info-circle me-1"></i>Data type not available in the active schema for this column — the original value will be used in the ELSE branch, as before.</span>';
      return box;
    }
    var needsConv = window.APSQL_DATATYPE ? window.APSQL_DATATYPE.needsConversion(dataType) : false;
    var header = document.createElement('div');
    header.innerHTML = '<span class="decode-datatype-label">Data Type:</span> <code>' + esc(dataType) + '</code>';
    box.appendChild(header);
    if (!needsConv) {
      var note = document.createElement('div'); note.className = 'small text-body-secondary mt-1';
      note.textContent = 'This column is already text-compatible, so no ELSE conversion is needed.';
      box.appendChild(note);
      return box;
    }
    var row = document.createElement('div'); row.className = 'decode-else-mode-row';
    var uid = tname + '_' + colName;
    var convertId = 'elseConvert_' + uid, keepId = 'elseKeep_' + uid;
    row.innerHTML =
      '<div class="form-check"><input class="form-check-input" type="radio" name="elseMode_' + uid + '" id="' + convertId + '" ' + (state.elseMode !== 'keep' ? 'checked' : '') + '><label class="form-check-label small" for="' + convertId + '">Convert to compatible text</label></div>' +
      '<div class="form-check"><input class="form-check-input" type="radio" name="elseMode_' + uid + '" id="' + keepId + '" ' + (state.elseMode === 'keep' ? 'checked' : '') + '><label class="form-check-label small" for="' + keepId + '">Keep original value</label></div>';
    row.querySelector('#' + convertId).addEventListener('change', function () { state.elseMode = 'convert'; });
    row.querySelector('#' + keepId).addEventListener('change', function () { state.elseMode = 'keep'; });
    box.appendChild(row);
    return box;
  }

  function buildColumnRow(tname, col) {
    var state = ensureColState(tname);
    if (!state[col.name]) state[col.name] = { checked: false, alias: col.alias || '', decode: false, elseMode: 'convert' };
    var s = state[col.name];
    if (s.elseMode === undefined) s.elseMode = 'convert';
    var row = document.createElement('div'); row.id = 'colrow_' + tname + '_' + col.name; row.className = 'column-row-grid' + (s.checked ? ' on' : '');
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'form-check-input col-check'; cb.checked = s.checked;
    var nameWrap = document.createElement('div'); nameWrap.className = 'col-name';
    var badgeText = col.primary_key ? 'PK' : (col.foreign_key ? 'FK' : (col.type || '').split('(')[0]);
    nameWrap.innerHTML = '<code>' + col.name + '</code> <span class="text-body-secondary small">' + esc(badgeText) + '</span>' + (col.description ? '<div class="text-body-secondary" style="font-size:.72rem;">' + esc(col.description) + '</div>' : '');
    var aliasInput = document.createElement('input'); aliasInput.type = 'text'; aliasInput.className = 'form-control form-control-sm col-alias'; aliasInput.placeholder = 'rename (optional)'; aliasInput.value = s.alias; aliasInput.disabled = !s.checked;
    var decodeWrap = document.createElement('div'); decodeWrap.className = 'd-flex flex-column gap-1 col-decode-check col-decode' + (!s.checked ? ' disabled' : '');
    var decodeControlsRow = document.createElement('div'); decodeControlsRow.className = 'd-flex align-items-center gap-1';
    var decodeCb = document.createElement('input'); decodeCb.type = 'checkbox'; decodeCb.className = 'form-check-input mt-0'; decodeCb.checked = s.decode; decodeCb._rowChecked = s.checked;
    var decodeInline = buildDecodeInlineEditor(tname, col, decodeCb, decodeWrap);
    decodeControlsRow.appendChild(decodeCb); decodeControlsRow.appendChild(decodeInline); decodeWrap.appendChild(decodeControlsRow);
    var dataTypePanel = null;
    function refreshDataTypePanel() {
      if (dataTypePanel) { dataTypePanel.remove(); dataTypePanel = null; }
      if (s.decode && s.checked) { dataTypePanel = buildDataTypeElseModePanel(tname, col.name, s); decodeWrap.appendChild(dataTypePanel); }
    }
    function refreshAccess() {
      row.classList.toggle('on', cb.checked); aliasInput.disabled = !cb.checked; decodeWrap.classList.toggle('disabled', !cb.checked);
      decodeCb._rowChecked = cb.checked; if (decodeInline._syncLabel) decodeInline._syncLabel(); if (!cb.checked) decodeCb.disabled = true;
      refreshDataTypePanel();
    }
    cb.addEventListener('change', function () { s.checked = cb.checked; if (!cb.checked) { s.decode = false; decodeCb.checked = false; } refreshAccess(); refreshFilterColumnOptions(); });
    aliasInput.addEventListener('input', function () { s.alias = aliasInput.value.trim(); });
    decodeCb.addEventListener('change', function () { s.decode = decodeCb.checked; refreshDataTypePanel(); });
    row.appendChild(cb); row.appendChild(nameWrap); row.appendChild(aliasInput); row.appendChild(decodeWrap);
    refreshAccess();
    return row;
  }
  function renderColumnList() {
    var body = $('columnListBody'); body.innerHTML = '';
    var tname = $('selectedTableDropdown').value;
    if (selectedTables.length === 0) { $('columnListEmpty').textContent = 'Select one or more tables above, then pick a table to view its columns.'; return; }
    if (!tname) { $('columnListEmpty').textContent = 'Pick a selected table above to view and choose its columns.'; return; }
    $('columnListEmpty').textContent = '';
    var table = engine.getTable(tname); if (!table) return;
    var term = ($('columnSearchInput').value || '').toLowerCase().trim();
    var cols = table.columns.filter(function (c) { return !term || (c.name + ' ' + (c.alias || '') + ' ' + (c.description || '')).toLowerCase().indexOf(term) !== -1; });
    var heading = document.createElement('div'); heading.className = 'col-group-heading'; heading.textContent = tname;
    body.appendChild(heading);
    cols.forEach(function (c) { body.appendChild(buildColumnRow(tname, c)); });
  }
  $('columnSearchInput').addEventListener('input', renderColumnList);
  $('columnSelectAllBtn').addEventListener('click', function () { var tname = $('selectedTableDropdown').value; if (!tname) return; var table = engine.getTable(tname); var state = ensureColState(tname); table.columns.forEach(function (c) { if (!state[c.name]) state[c.name] = { checked: false, alias: c.alias || '', decode: false, elseMode: 'convert' }; state[c.name].checked = true; }); renderColumnList(); refreshFilterColumnOptions(); });
  $('columnUnselectAllBtn').addEventListener('click', function () { var tname = $('selectedTableDropdown').value; if (!tname) return; var state = ensureColState(tname); Object.keys(state).forEach(function (k) { state[k].checked = false; state[k].decode = false; }); renderColumnList(); refreshFilterColumnOptions(); });
  function refreshTablesColumnsUI() {
    refreshModuleDropdown(); renderTableList(); refreshTableSelCount(); refreshSelectedTableDropdown(); renderColumnList(); refreshFilterColumnOptions();
    renderJoinPreview(); renderSortRows(); renderExistsRows(); renderScalarRows();
  }
  function refreshHierarchyOptions() {
    var sel = $('optHierarchy'); var current = sel.value; var opts = ['<option value="">&mdash; none &mdash;</option>'];
    allTables().forEach(function (t) { if (engine.getSelfReferencingEdges(t.name).length > 0) opts.push('<option value="' + t.name + '">' + t.name + '</option>'); });
    sel.innerHTML = opts.join(''); if (allTables().some(function (t) { return t.name === current; })) sel.value = current;
  }

  function columnOptionsForTables(tableNames) {
    var opts = [];
    (tableNames && tableNames.length ? tableNames : allTables().map(function (t) { return t.name; })).forEach(function (tname) { var t = engine.getTable(tname); if (!t) return; t.columns.forEach(function (c) { opts.push({ table: tname, column: c.name }); }); });
    return opts;
  }
  function renderFilterGroup(containerEl, filterGroup, availableTables, onChange) {
    containerEl.innerHTML = '';
    var colOptions = columnOptionsForTables(availableTables);
    filterGroup.conditions.forEach(function (cond, idx) {
      var row = document.createElement('div'); row.className = 'filter-condition-row' + (idx === 0 ? ' first-condition' : '');
      var joinSel = document.createElement('select'); joinSel.className = 'form-select form-select-sm join-select'; joinSel.innerHTML = '<option value="AND">AND</option><option value="OR">OR</option>'; joinSel.value = cond.join || 'AND';
      joinSel.addEventListener('change', function () { cond.join = joinSel.value; onChange(); });
      var colSel = document.createElement('select'); colSel.className = 'form-select form-select-sm filter-col-select';
      colSel.innerHTML = colOptions.map(function (o) { var val = o.table + '.' + o.column; return '<option value="' + val + '">' + o.table + '.' + o.column + '</option>'; }).join('');
      colSel.value = (cond.table ? cond.table + '.' : '') + cond.column;
      colSel.addEventListener('change', function () { var parts = colSel.value.split('.'); cond.table = parts[0]; cond.column = parts[1]; onChange(); });
      var opSel = document.createElement('select'); opSel.className = 'form-select form-select-sm filter-op-select';
      opSel.innerHTML = APSQL_FILTER.OPERATORS.map(function (o) { return '<option value="' + o.id + '">' + o.label + '</option>'; }).join(''); opSel.value = cond.operator;
      var valInput = document.createElement('input'); valInput.className = 'form-control form-control-sm filter-value-input'; valInput.placeholder = 'Value'; valInput.value = cond.value || '';
      var val2Input = document.createElement('input'); val2Input.className = 'form-control form-control-sm filter-value2-input'; val2Input.placeholder = 'and...'; val2Input.value = cond.value2 || '';
      function refreshArity() { var op = APSQL_FILTER.getOperator(opSel.value); valInput.style.display = op.arity >= 1 ? '' : 'none'; val2Input.style.display = op.arity === 2 ? '' : 'none'; }
      opSel.addEventListener('change', function () { cond.operator = opSel.value; refreshArity(); onChange(); });
      valInput.addEventListener('input', function () { cond.value = valInput.value; });
      val2Input.addEventListener('input', function () { cond.value2 = val2Input.value; });
      refreshArity();
      var toolbar = document.createElement('div'); toolbar.className = 'd-flex gap-1 filter-remove-btn';
      var dupBtn = document.createElement('button'); dupBtn.type = 'button'; dupBtn.className = 'btn btn-outline-secondary btn-sm'; dupBtn.title = 'Duplicate'; dupBtn.textContent = '\u29C9';
      dupBtn.addEventListener('click', function () { var copy = APSQL_FILTER.duplicateCondition(cond); filterGroup.conditions.splice(idx + 1, 0, copy); onChange(); renderFilterGroup(containerEl, filterGroup, availableTables, onChange); });
      var rmBtn = document.createElement('button'); rmBtn.type = 'button'; rmBtn.className = 'btn btn-outline-danger btn-sm'; rmBtn.title = 'Remove'; rmBtn.textContent = '\u00d7';
      rmBtn.addEventListener('click', function () { filterGroup.conditions.splice(idx, 1); onChange(); renderFilterGroup(containerEl, filterGroup, availableTables, onChange); });
      toolbar.appendChild(dupBtn); toolbar.appendChild(rmBtn);
      row.appendChild(joinSel); row.appendChild(colSel); row.appendChild(opSel); row.appendChild(valInput); row.appendChild(val2Input); row.appendChild(toolbar);
      containerEl.appendChild(row);
    });
    if (!colOptions.length) containerEl.innerHTML = '<p class="text-body-secondary small mb-0">Select at least one table first to build filter conditions.</p>';
  }
  var readOnlyFilterGroup = { conditions: [] };
  function refreshFilterColumnOptions() { renderFilterGroup($('readOnlyFilterGroup'), readOnlyFilterGroup, selectedTables, function () {}); }
  $('readOnlyAddFilterBtn').addEventListener('click', function () { var firstTable = selectedTables[0]; var firstCol = firstTable ? engine.getTable(firstTable).columns[0].name : ''; readOnlyFilterGroup.conditions.push(APSQL_FILTER.newCondition({ table: firstTable, column: firstCol })); refreshFilterColumnOptions(); });
  $('readOnlyClearFiltersBtn').addEventListener('click', function () { readOnlyFilterGroup.conditions = []; refreshFilterColumnOptions(); });

  function updateJoinCardVisibility() {
    var card = $('joinOptionCard'); if (!card) return;
    if (selectedTables.length < 2) { card.classList.add('d-none'); $('optJoinInner').checked = true; syncJoinChoiceHighlight(); }
    else card.classList.remove('d-none');
  }
  function syncJoinChoiceHighlight() {
    $('optJoinInnerLabel').classList.toggle('selected', $('optJoinInner').checked);
    $('optJoinLeftLabel').classList.toggle('selected', $('optJoinLeft').checked);
  }
  document.querySelectorAll('input[name="joinType"]').forEach(function (r) { r.addEventListener('change', syncJoinChoiceHighlight); });
  $('joinResetBtn').addEventListener('click', function () { $('optJoinInner').checked = true; syncJoinChoiceHighlight(); });
  syncJoinChoiceHighlight();

  var relationshipDrafts = {};
  function ensureRelationshipDraft(tableName, candidatePartners) {
    if (!relationshipDrafts[tableName]) {
      var partner = candidatePartners[0] || '';
      var partnerTbl = engine.getTable(partner);
      var thisTbl = engine.getTable(tableName);
      relationshipDrafts[tableName] = { partnerTable: partner, thisColumn: thisTbl && thisTbl.columns[0] ? thisTbl.columns[0].name : '', partnerColumn: partnerTbl && partnerTbl.columns[0] ? partnerTbl.columns[0].name : '' };
    }
    return relationshipDrafts[tableName];
  }

  function renderJoinPreview() {
    updateJoinCardVisibility();
    var previewBox = $('joinPreviewBox'); var defineBox = $('defineRelationshipContainer');
    if (!previewBox || !defineBox) return;
    if (selectedTables.length < 2) { previewBox.innerHTML = '<p class="multi-row-empty">Select two or more tables on the Tables &amp; Columns tab to see how they\u2019ll be connected.</p>'; defineBox.innerHTML = ''; return; }
    var plan = APSQL_ENGINE.buildJoinPlan(engine, selectedTables);
    var lines = plan.joins.map(function (j) { return '<li><code>' + j.on.fromTable + '</code> \u2192 <code>' + j.on.toTable + '</code> using <code>' + j.on.fromColumn + ' = ' + j.on.toColumn + '</code></li>'; });
    if (!lines.length) lines.push('<li class="text-body-secondary">No connections established yet.</li>');
    previewBox.innerHTML = '<ul class="mb-0 small">' + lines.join('') + '</ul>';
    defineBox.innerHTML = '';
    plan.unresolved.forEach(function (tname) {
      var candidatePartners = selectedTables.filter(function (t) { return t !== tname; });
      var draft = ensureRelationshipDraft(tname, candidatePartners);
      defineBox.appendChild(buildDefineRelationshipPanel(tname, candidatePartners, draft));
    });
  }
  function buildDefineRelationshipPanel(tableName, candidatePartners, draft) {
    var box = document.createElement('div'); box.className = 'define-relationship-box';
    var title = document.createElement('div'); title.className = 'define-relationship-title';
    title.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-warning"></i> Could not automatically connect: <code>' + tableName + '</code>';
    box.appendChild(title);
    var explain = document.createElement('p'); explain.className = 'small text-body-secondary mb-2';
    explain.textContent = 'Pick which table it connects to, and which column on each side matches.';
    box.appendChild(explain);
    var row = document.createElement('div'); row.className = 'define-relationship-row';
    var partnerSel = document.createElement('select'); partnerSel.className = 'form-select form-select-sm';
    partnerSel.innerHTML = candidatePartners.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
    partnerSel.value = draft.partnerTable;
    var thisColSel = document.createElement('select'); thisColSel.className = 'form-select form-select-sm';
    var partnerColSel = document.createElement('select'); partnerColSel.className = 'form-select form-select-sm';
    function refreshColumnSelects() {
      var thisTbl = engine.getTable(tableName);
      thisColSel.innerHTML = (thisTbl ? thisTbl.columns : []).map(function (c) { return '<option value="' + c.name + '">' + c.name + '</option>'; }).join('');
      if (thisTbl && thisTbl.columns.some(function (c) { return c.name === draft.thisColumn; })) thisColSel.value = draft.thisColumn;
      var partnerTbl = engine.getTable(partnerSel.value);
      partnerColSel.innerHTML = (partnerTbl ? partnerTbl.columns : []).map(function (c) { return '<option value="' + c.name + '">' + c.name + '</option>'; }).join('');
      if (partnerTbl && partnerTbl.columns.some(function (c) { return c.name === draft.partnerColumn; })) partnerColSel.value = draft.partnerColumn;
      else if (partnerTbl && partnerTbl.columns[0]) draft.partnerColumn = partnerTbl.columns[0].name;
    }
    refreshColumnSelects();
    partnerSel.addEventListener('change', function () { draft.partnerTable = partnerSel.value; refreshColumnSelects(); });
    thisColSel.addEventListener('change', function () { draft.thisColumn = thisColSel.value; });
    partnerColSel.addEventListener('change', function () { draft.partnerColumn = partnerColSel.value; });
    var connectLabel = document.createElement('span'); connectLabel.className = 'small text-body-secondary'; connectLabel.textContent = 'connects to';
    var colLabel1 = document.createElement('span'); colLabel1.className = 'small text-body-secondary'; colLabel1.textContent = tableName + '.';
    var colLabel2 = document.createElement('span'); colLabel2.className = 'small text-body-secondary'; colLabel2.textContent = 'on column';
    row.appendChild(connectLabel); row.appendChild(partnerSel); row.appendChild(colLabel2);
    row.appendChild(colLabel1); row.appendChild(thisColSel);
    var eqLabel = document.createElement('span'); eqLabel.className = 'small text-body-secondary'; eqLabel.textContent = '=';
    row.appendChild(eqLabel); row.appendChild(partnerColSel);
    box.appendChild(row);
    var activeBadge = document.createElement('span'); activeBadge.className = 'badge text-bg-success relationship-active-badge d-none';
    activeBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Active for this session';
    if (relationshipStore.hasManualRelationship(tableName, draft.partnerTable)) activeBadge.classList.remove('d-none');
    var actions = document.createElement('div'); actions.className = 'define-relationship-actions mt-2';
    var useBtn = document.createElement('button'); useBtn.type = 'button'; useBtn.className = 'btn btn-outline-primary btn-sm'; useBtn.innerHTML = '<i class="bi bi-link me-1"></i>Use for this query';
    useBtn.addEventListener('click', function () { relationshipStore.setManualRelationship(tableName, thisColSel.value, partnerSel.value, partnerColSel.value); renderJoinPreview(); });
    var saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.className = 'btn btn-outline-success btn-sm'; saveBtn.innerHTML = '<i class="bi bi-shield-lock-fill me-1"></i>Save relationship to schema';
    saveBtn.addEventListener('click', function () {
      pendingSaveRelationshipDraft = { fromTable: tableName, fromColumn: thisColSel.value, toTable: partnerSel.value, toColumn: partnerColSel.value };
      $('saveRelationshipSummary').innerHTML = '<code>' + tableName + '.' + thisColSel.value + '</code> &rarr; <code>' + partnerSel.value + '.' + partnerColSel.value + '</code>';
      $('saveRelationshipPasswordInput').value = ''; $('saveRelationshipPasswordError').classList.add('d-none');
      if (saveRelationshipModal) saveRelationshipModal.show();
    });
    actions.appendChild(useBtn); actions.appendChild(saveBtn); actions.appendChild(activeBadge);
    box.appendChild(actions);
    return box;
  }

  var sortRows = [];
  function renderSortRows() {
    var container = $('sortRowsContainer'); if (!container) return;
    container.innerHTML = '';
    var colOptions = columnOptionsForTables(selectedTables);
    if (!colOptions.length) { container.innerHTML = '<p class="multi-row-empty">Select at least one table on the Tables &amp; Columns tab first.</p>'; return; }
    if (!sortRows.length) { container.innerHTML = '<p class="multi-row-empty">No sort columns added yet \u2014 results will be shown in default order.</p>'; return; }
    sortRows.forEach(function (row, idx) {
      var rowEl = document.createElement('div'); rowEl.className = 'filter-condition-row';
      var colSel = document.createElement('select'); colSel.className = 'form-select form-select-sm filter-col-select';
      colSel.innerHTML = colOptions.map(function (o) { var val = o.table + '.' + o.column; return '<option value="' + val + '">' + o.table + '.' + o.column + '</option>'; }).join('');
      colSel.value = (row.table ? row.table + '.' : '') + row.column;
      colSel.addEventListener('change', function () { var parts = colSel.value.split('.'); row.table = parts[0]; row.column = parts[1]; });
      var dirSel = document.createElement('select'); dirSel.className = 'form-select form-select-sm filter-op-select';
      dirSel.innerHTML = '<option value="ASC">Smallest / earliest first</option><option value="DESC">Largest / latest first</option>';
      dirSel.value = row.direction || 'ASC';
      dirSel.addEventListener('change', function () { row.direction = dirSel.value; });
      var rmBtn = document.createElement('button'); rmBtn.type = 'button'; rmBtn.className = 'btn btn-outline-danger btn-sm filter-remove-btn'; rmBtn.textContent = '\u00d7';
      rmBtn.addEventListener('click', function () { sortRows.splice(idx, 1); renderSortRows(); });
      rowEl.appendChild(colSel); rowEl.appendChild(dirSel); rowEl.appendChild(rmBtn);
      container.appendChild(rowEl);
    });
  }
  $('addSortRowBtn').addEventListener('click', function () { if (!selectedTables.length) return; var t = selectedTables[0]; var tbl = engine.getTable(t); sortRows.push({ table: t, column: tbl ? tbl.columns[0].name : '', direction: 'ASC' }); renderSortRows(); });
  $('clearSortBtn').addEventListener('click', function () { sortRows = []; renderSortRows(); });

  var existsRows = [];
  function renderExistsRows() {
    var container = $('existsRowsContainer'); if (!container) return;
    container.innerHTML = '';
    var tbls = allTables();
    if (!existsRows.length) { container.innerHTML = '<p class="multi-row-empty">No related-table checks added yet.</p>'; return; }
    existsRows.forEach(function (row, idx) {
      var rowEl = document.createElement('div'); rowEl.className = 'filter-condition-row';
      var tblSel = document.createElement('select'); tblSel.className = 'form-select form-select-sm filter-col-select';
      tblSel.innerHTML = tbls.map(function (t) { return '<option value="' + t.name + '">' + t.name + '</option>'; }).join('');
      tblSel.value = row.relatedTable || (tbls[0] ? tbls[0].name : '');
      tblSel.addEventListener('change', function () { row.relatedTable = tblSel.value; });
      var negWrap = document.createElement('div'); negWrap.className = 'form-check d-flex align-items-center gap-1';
      var negCb = document.createElement('input'); negCb.type = 'checkbox'; negCb.className = 'form-check-input mt-0'; negCb.checked = !!row.negate;
      negCb.addEventListener('change', function () { row.negate = negCb.checked; });
      var negLabel = document.createElement('label'); negLabel.className = 'form-check-label multi-row-remove-label'; negLabel.textContent = 'Opposite (no match)';
      negWrap.appendChild(negCb); negWrap.appendChild(negLabel);
      var rmBtn = document.createElement('button'); rmBtn.type = 'button'; rmBtn.className = 'btn btn-outline-danger btn-sm filter-remove-btn'; rmBtn.textContent = '\u00d7';
      rmBtn.addEventListener('click', function () { existsRows.splice(idx, 1); renderExistsRows(); });
      rowEl.appendChild(tblSel); rowEl.appendChild(negWrap); rowEl.appendChild(rmBtn);
      container.appendChild(rowEl);
    });
  }
  $('addExistsRowBtn').addEventListener('click', function () { var tbls = allTables(); if (!tbls.length) return; existsRows.push({ relatedTable: tbls[0].name, negate: false }); renderExistsRows(); });
  $('clearExistsBtn').addEventListener('click', function () { existsRows = []; renderExistsRows(); });

  var scalarRows = [];
  function renderScalarRows() {
    var container = $('scalarRowsContainer'); if (!container) return;
    container.innerHTML = '';
    var tbls = allTables();
    if (!scalarRows.length) { container.innerHTML = '<p class="multi-row-empty">No related counts added yet.</p>'; return; }
    scalarRows.forEach(function (row, idx) {
      var rowEl = document.createElement('div'); rowEl.className = 'filter-condition-row';
      var tblSel = document.createElement('select'); tblSel.className = 'form-select form-select-sm filter-col-select';
      tblSel.innerHTML = tbls.map(function (t) { return '<option value="' + t.name + '">' + t.name + '</option>'; }).join('');
      tblSel.value = row.relatedTable || (tbls[0] ? tbls[0].name : '');
      tblSel.addEventListener('change', function () { row.relatedTable = tblSel.value; });
      var label = document.createElement('span'); label.className = 'small text-body-secondary'; label.textContent = 'Count of matching records';
      var rmBtn = document.createElement('button'); rmBtn.type = 'button'; rmBtn.className = 'btn btn-outline-danger btn-sm filter-remove-btn'; rmBtn.textContent = '\u00d7';
      rmBtn.addEventListener('click', function () { scalarRows.splice(idx, 1); renderScalarRows(); });
      rowEl.appendChild(tblSel); rowEl.appendChild(label); rowEl.appendChild(rmBtn);
      container.appendChild(rowEl);
    });
  }
  $('addScalarRowBtn').addEventListener('click', function () { var tbls = allTables(); if (!tbls.length) return; scalarRows.push({ relatedTable: tbls[0].name }); renderScalarRows(); });
  $('clearScalarBtn').addEventListener('click', function () { scalarRows = []; renderScalarRows(); });

  $('optLimitClearBtn').addEventListener('click', function () { $('optLimit').value = ''; });
  $('optViewClearBtn').addEventListener('click', function () { $('optView').value = ''; });
  $('optHavingClearBtn').addEventListener('click', function () { $('optHaving').value = ''; });
  $('optHierarchyClearBtn').addEventListener('click', function () { $('optHierarchy').value = ''; });

  var KW = /\b(SELECT|FROM|WHERE|JOIN|LEFT|INNER|ON|AND|OR|GROUP BY|ORDER BY|HAVING|DISTINCT|AS|TOP|FETCH FIRST|ROWS ONLY|BETWEEN|LIMIT|CASE|WHEN|THEN|ELSE|END|WITH|RECURSIVE|EXISTS|NOT|LIKE|IS NULL|IS NOT NULL)\b/g;
  function highlight(sql) { var e = esc(sql); e = e.replace(/'([^']*)'/g, "<span class='sql-str'>'$1'</span>"); e = e.replace(KW, "<span class='sql-kw'>$1</span>"); return e; }

  function renderSuggestedFixes(message) {
    var suggestions = APSQL_SUGGEST.buildSuggestions(message);
    return '<div class="alert alert-info py-2 mb-0 suggested-fixes-box"><strong><i class="bi bi-lightbulb-fill me-1"></i>Suggested fixes:</strong><ul class="mt-1">' + suggestions.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>';
  }
  function renderOptimizeReport(containerId, opt) {
    var box = $(containerId); if (!box) return;
    var parts = [];
    if (opt.changesApplied.length) parts.push('<div><strong><i class="bi bi-magic me-1"></i>Changes applied:</strong><ul class="mt-1">' + opt.changesApplied.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>');
    if (opt.recommendations.length) parts.push('<div><strong><i class="bi bi-lightbulb-fill me-1"></i>Recommendations:</strong><ul class="mt-1">' + opt.recommendations.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>');
    if (!parts.length) parts.push('<div class="text-body-secondary">No further optimizations detected \u2014 this query already looks efficient.</div>');
    box.innerHTML = '<div class="alert alert-secondary py-2 mb-0 small">' + parts.join('') + '</div>';
  }

  var lastResult = null;
  function renderResult(res) {
    lastResult = res;
    var body = $('resultBody');
    if (res.status === 'rejected' || res.status === 'clarification_needed') {
      var titleText = res.status === 'rejected' ? 'Could not build this query.' : 'One more detail needed.';
      var alertClass = res.status === 'rejected' ? 'alert-danger' : 'alert-warning';
      body.innerHTML = '<div class="alert ' + alertClass + ' mb-2"><strong>' + titleText + '</strong><br>' + esc(res.message) + '</div>' + renderSuggestedFixes(res.message);
      $('copyBtn').classList.add('d-none'); $('optimizeBtn').classList.add('d-none'); $('optimizeReportBox').innerHTML = '';
      return;
    }
    var tables = (res.tablesUsed || []).map(function (t) { return '<span class="badge text-bg-light border me-1">' + t + '</span>'; }).join('');
    var cols = (res.columnsUsed || []).map(function (c) { return '<span class="badge text-bg-light border me-1">' + c.table + '.' + c.column + (c.alias ? ' as ' + c.alias : '') + '</span>'; }).join('');
    var filters = (res.filtersApplied || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') || '<li class="text-body-secondary">None</li>';
    var assumptions = (res.assumptions || []).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('');
    body.innerHTML = '<div class="alert alert-success py-2 mb-2"><small>&#9989; Query validated against active schema (' + esc(res.dialect || '') + ', read-only)</small></div><pre class="sql-output mb-3">' + highlight(res.sql) + '</pre><div class="small mb-2"><strong>Tables Used:</strong><br>' + (tables || '<span class="text-body-secondary">None</span>') + '</div><div class="small mb-2"><strong>Columns Used:</strong><br>' + (cols || '<span class="text-body-secondary">None (aggregated query)</span>') + '</div><div class="small mb-2"><strong>Filters Applied:</strong><ul class="mb-0">' + filters + '</ul></div><div class="small"><strong>Assumptions:</strong><ul class="mb-0">' + assumptions + '</ul></div>';
    $('copyBtn').classList.remove('d-none'); $('optimizeBtn').classList.remove('d-none'); $('optimizeReportBox').innerHTML = '';
  }
  $('copyBtn').addEventListener('click', function () { if (lastResult && lastResult.status === 'ok') { navigator.clipboard && navigator.clipboard.writeText(lastResult.sql); var old = $('copyBtn').innerHTML; $('copyBtn').innerHTML = '&#9989; Copied'; setTimeout(function () { $('copyBtn').innerHTML = old; }, 1300); } });
  $('optimizeBtn').addEventListener('click', function () {
    if (!lastResult || lastResult.status !== 'ok') return;
    var opt = APSQL_OPTIMIZE.optimizeSql(engine, lastResult);
    if (opt.hasChanges) { lastResult = Object.assign({}, lastResult, { sql: opt.optimizedSql }); renderResult(lastResult); }
    renderOptimizeReport('optimizeReportBox', opt);
  });

  function describeAdvancedOptions() {
    var lines = [];
    if ($('optJoinLeft').checked) lines.push('Also show records without a match in other tables');
    if (sortRows.length) lines.push('Sort by: ' + sortRows.map(function (r) { return r.table + '.' + r.column + ' (' + (r.direction === 'DESC' ? 'largest/latest first' : 'smallest/earliest first') + ')'; }).join(', '));
    var limit = $('optLimit').value.trim(); if (limit) lines.push('Only show the first ' + limit + ' rows');
    var view = $('optView').value.trim(); if (view) lines.push('Save as a named view: ' + view);
    if (existsRows.length) lines.push('Only show rows connected to: ' + existsRows.map(function (r) { return r.relatedTable + (r.negate ? ' (opposite: no match)' : ''); }).join(', '));
    if (scalarRows.length) lines.push('Add related counts from: ' + scalarRows.map(function (r) { return r.relatedTable; }).join(', '));
    var having = $('optHaving').value.trim(); if (having) lines.push('Filter on totals: ' + having);
    var hier = $('optHierarchy').value; if (hier) lines.push('Show full hierarchy for: ' + hier);
    return lines;
  }
  function renderRequirementsSummary() {
    var box = $('requirementsSummaryBody'); var promptText = $('promptInput').value.trim(); var parts = [];
    parts.push('<h3 class="h6">Describe What You Need</h3>');
    parts.push(promptText ? '<p><em>' + esc(promptText) + '</em></p>' : '<p class="text-body-secondary">No natural-language requirement provided.</p>');
    parts.push('<h3 class="h6 mt-3">Selected Tables</h3>');
    parts.push(selectedTables.length ? '<p>' + selectedTables.map(esc).join('<br>') + '</p>' : '<p class="text-body-secondary">No tables selected yet.</p>');
    parts.push('<h3 class="h6 mt-3">Selected Columns</h3>');
    var anyCols = false, colsHtml = '';
    Object.keys(columnState).forEach(function (tname) {
      var checkedCols = Object.keys(columnState[tname]).filter(function (c) { return columnState[tname][c].checked; });
      if (!checkedCols.length) return;
      anyCols = true;
      colsHtml += '<div class="mb-1"><code>' + tname + '</code><br>' + checkedCols.map(function (c) { var s = columnState[tname][c]; var extras = []; if (s.alias) extras.push('alias: ' + esc(s.alias)); if (s.decode) extras.push('decode: on (' + (s.elseMode === 'keep' ? 'keep original' : 'convert to text') + ')'); return '&#9500;&#9472; ' + c + (extras.length ? ' <span class="text-body-secondary small">(' + extras.join(', ') + ')</span>' : ''); }).join('<br>') + '</div>';
    });
    parts.push(anyCols ? colsHtml : '<p class="text-body-secondary">No columns selected yet.</p>');
    parts.push('<h3 class="h6 mt-3">Filters</h3>');
    var builtFilters = APSQL_FILTER.buildWhereSql(readOnlyFilterGroup, $('dialectSel').value);
    parts.push(builtFilters.plainEnglish ? '<p><code>' + esc(builtFilters.plainEnglish) + '</code></p>' : '<p class="text-body-secondary">No filters added yet.</p>');
    parts.push('<h3 class="h6 mt-3">Advanced Options</h3>');
    var advLines = describeAdvancedOptions();
    parts.push(advLines.length ? '<p>' + advLines.map(esc).join('<br>') + '</p>' : '<p class="text-body-secondary">No advanced options enabled.</p>');
    box.innerHTML = parts.join('');
  }
  function collectSelectedColumns() {
    var out = [];
    Object.keys(columnState).forEach(function (tname) { Object.keys(columnState[tname]).forEach(function (cname) { var s = columnState[tname][cname]; if (s.checked) { var entry = { table: tname, column: cname }; if (s.alias) entry.alias = s.alias; if (s.decode) { entry.decode = true; entry.elseMode = s.elseMode || 'convert'; } out.push(entry); } }); });
    return out;
  }
  function buildOptions() {
    var opts = { dialect: $('dialectSel').value };
    if (selectedTables.length) opts.selectedTables = selectedTables.slice();
    var cols = collectSelectedColumns(); if (cols.length) opts.selectedColumns = cols;
    if (readOnlyFilterGroup.conditions.length) opts.filterGroup = readOnlyFilterGroup;
    if ($('optDistinct2').checked) opts.distinct = true;
    opts.join = $('optJoinLeft').checked ? 'LEFT' : 'INNER';
    var limit = $('optLimit').value.trim(); if (/^\d+$/.test(limit)) opts.limit = parseInt(limit, 10);
    if (sortRows.length) opts.orderBy = sortRows.map(function (r) { return r.table + '.' + r.column + ' ' + r.direction; }).join(', ');
    var view = $('optView').value.trim(); if (view) opts.viewName = view;
    var hier = $('optHierarchy').value; if (hier) opts.recursiveHierarchy = { table: hier };
    if (existsRows.length) opts.existsFilters = existsRows.map(function (r) { return { relatedTable: r.relatedTable, negate: r.negate }; });
    if (scalarRows.length) opts.scalarSubqueries = scalarRows.map(function (r) { return { relatedTable: r.relatedTable }; });
    var having = $('optHaving').value.trim(); if (having) opts.having = having;
    return opts;
  }

  function applyDescriptionToSelection() {
    var text = $('promptInput').value.trim();
    if (!text) { $('descriptionInterpretationBox').innerHTML = ''; return; }
    var interpretation = APSQL_NLQUERY.interpretDescription(text, engine, {});

    selectedTables = APSQL_NLQUERY.mergeTableLists(selectedTables, interpretation.tables);

    var manualColsFlat = collectSelectedColumns();
    var mergedCols = APSQL_NLQUERY.mergeColumnLists(manualColsFlat, interpretation.columns);
    mergedCols.forEach(function (c) {
      var state = ensureColState(c.table);
      if (!state[c.column]) state[c.column] = { checked: true, alias: c.alias || '', decode: false, elseMode: 'convert' };
      else state[c.column].checked = true;
    });

    readOnlyFilterGroup.conditions = APSQL_NLQUERY.mergeFilterConditions(readOnlyFilterGroup.conditions, interpretation.filterConditions).map(function (c) {
      return c.id ? c : APSQL_FILTER.newCondition(c);
    });

    if (!sortRows.length && interpretation.orderBy && interpretation.orderBy.length) {
      interpretation.orderBy.forEach(function (o) { sortRows.push({ table: o.table, column: o.column, direction: o.direction || 'ASC' }); });
    }
    if (!$('optLimit').value.trim() && interpretation.limit) $('optLimit').value = String(interpretation.limit);
    if (interpretation.distinct) $('optDistinct2').checked = true;
    if (!$('optHierarchy').value && interpretation.hierarchyTable) $('optHierarchy').value = interpretation.hierarchyTable;

    refreshTablesColumnsUI();
    renderDescriptionInterpretationBox(interpretation);
  }
  function renderDescriptionInterpretationBox(interpretation) {
    var box = $('descriptionInterpretationBox'); if (!box) return;
    var hasMatched = interpretation.matched && interpretation.matched.length;
    var hasWarnings = interpretation.warnings && interpretation.warnings.length;
    if (!hasMatched && !hasWarnings) { box.innerHTML = ''; return; }
    var parts = [];
    if (hasMatched) parts.push('<strong><i class="bi bi-chat-left-text-fill me-1"></i>Interpreted from your description:</strong><ul class="mt-1 mb-0">' + interpretation.matched.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>');
    if (hasWarnings) parts.push('<div class="' + (hasMatched ? 'mt-2 ' : '') + 'text-body-secondary small">' + interpretation.warnings.map(esc).join('<br>') + '</div>');
    box.innerHTML = '<div class="alert alert-info py-2 mb-0 small">' + parts.join('') + '</div>';
  }

  function runGenerate() {
    applyDescriptionToSelection();
    var promptText = $('promptInput').value.trim();
    var opts = buildOptions();
    var res = APSQL_ENGINE.generateSql(promptText, opts, engine, decodeStore);
    renderResult(res);
    showView('builder');
    $('resultBody').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $('generateBtn').addEventListener('click', runGenerate);
  $('generateFromDescriptionBtn').addEventListener('click', runGenerate);
  $('promptInput').addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runGenerate(); });
  refreshTablesColumnsUI(); refreshHierarchyOptions();

  var crCommand = 'INSERT'; var crTable = ''; var crInsertColumns = {}; var crUpdateColumns = {}; var crFilterGroup = { conditions: [] }; var crLastResult = null;
  function crRefreshTableOptions() {
    var sel = $('crTableSelect'); var current = sel.value;
    sel.innerHTML = allTables().map(function (t) { return '<option value="' + t.name + '">' + t.name + '</option>'; }).join('');
    if (allTables().some(function (t) { return t.name === current; })) sel.value = current; else sel.value = allTables()[0] ? allTables()[0].name : '';
    crTable = sel.value;
  }
  $('crTableSelect').addEventListener('change', function () { crTable = $('crTableSelect').value; crInsertColumns = {}; crUpdateColumns = {}; crFilterGroup = { conditions: [] }; crRenderAll(); });
  document.querySelectorAll('.cr-command-option').forEach(function (opt) { opt.addEventListener('click', function () { document.querySelectorAll('.cr-command-option').forEach(function (o) { o.classList.remove('active'); }); opt.classList.add('active'); crCommand = opt.getAttribute('data-command'); crRenderAll(); }); });
  function crRenderInsertPanel() {
    var table = engine.getTable(crTable); var body = $('crInsertColumnsBody'); body.innerHTML = ''; if (!table) return;
    table.columns.forEach(function (c) {
      if (!crInsertColumns[c.name]) crInsertColumns[c.name] = { checked: false, value: '' };
      var s = crInsertColumns[c.name]; var row = document.createElement('div'); row.className = 'cr-value-row';
      var label = document.createElement('div'); var cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'form-check-input me-2'; cb.checked = s.checked;
      var span = document.createElement('span'); span.innerHTML = '<code>' + c.name + '</code> <span class="text-body-secondary small">' + esc((c.type || '')) + '</span>';
      label.appendChild(cb); label.appendChild(span);
      var valInput = document.createElement('input'); valInput.className = 'form-control form-control-sm'; valInput.placeholder = 'Value'; valInput.value = s.value; valInput.disabled = !s.checked;
      cb.addEventListener('change', function () { s.checked = cb.checked; valInput.disabled = !cb.checked; });
      valInput.addEventListener('input', function () { s.value = valInput.value; });
      row.appendChild(label); row.appendChild(valInput); body.appendChild(row);
    });
  }
  function crRenderUpdatePanel() {
    var table = engine.getTable(crTable); var body = $('crUpdateColumnsBody'); body.innerHTML = ''; if (!table) return;
    table.columns.forEach(function (c) {
      if (!crUpdateColumns[c.name]) crUpdateColumns[c.name] = { checked: false, value: '' };
      var s = crUpdateColumns[c.name]; var row = document.createElement('div'); row.className = 'cr-value-row';
      var label = document.createElement('div'); var cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'form-check-input me-2'; cb.checked = s.checked;
      var span = document.createElement('span'); span.innerHTML = '<code>' + c.name + '</code> <span class="text-body-secondary small">' + esc((c.type || '')) + '</span>';
      label.appendChild(cb); label.appendChild(span);
      var valInput = document.createElement('input'); valInput.className = 'form-control form-control-sm'; valInput.placeholder = 'New Value'; valInput.value = s.value; valInput.disabled = !s.checked;
      cb.addEventListener('change', function () { s.checked = cb.checked; valInput.disabled = !cb.checked; crRenderDecodePanel(); });
      valInput.addEventListener('input', function () { s.value = valInput.value; });
      row.appendChild(label); row.appendChild(valInput); body.appendChild(row);
    });
  }
  function crRenderWherePanel() { var showWhere = crCommand === 'UPDATE' || crCommand === 'DELETE' || crCommand === 'SELECT'; $('crWherePanel').classList.toggle('d-none', !showWhere); if (showWhere) renderFilterGroup($('crFilterGroup'), crFilterGroup, [crTable], function () {}); }
  $('crAddFilterBtn').addEventListener('click', function () { var firstCol = crTable && engine.getTable(crTable) ? engine.getTable(crTable).columns[0].name : ''; crFilterGroup.conditions.push(APSQL_FILTER.newCondition({ table: crTable, column: firstCol })); renderFilterGroup($('crFilterGroup'), crFilterGroup, [crTable], function () {}); });
  $('crClearFiltersBtn').addEventListener('click', function () { crFilterGroup.conditions = []; renderFilterGroup($('crFilterGroup'), crFilterGroup, [crTable], function () {}); });
  function crRenderDecodePanel() {
    var body = $('crDecodeBody'); var table = engine.getTable(crTable); if (!table) { body.innerHTML = ''; return; }
    var relevantCols = (crCommand === 'INSERT' ? Object.keys(crInsertColumns) : Object.keys(crUpdateColumns)).filter(function (name) { var s = crCommand === 'INSERT' ? crInsertColumns[name] : crUpdateColumns[name]; return s && s.checked; });
    if (!relevantCols.length) { body.innerHTML = '<p class="text-body-secondary small mb-0">Select a column above to configure or view its decode.</p>'; return; }
    body.innerHTML = '';
    relevantCols.forEach(function (colName) {
      var resolved = APSQL_DECODE.resolveDecode(engine, decodeStore, crTable, colName);
      var box = document.createElement('div'); box.className = 'mb-3';
      var header = document.createElement('div'); header.className = 'd-flex align-items-center gap-2 mb-1'; header.innerHTML = '<code>' + colName + '</code>';
      if (resolved.source) header.innerHTML += '<span class="badge text-bg-light border decode-source-badge">' + (resolved.source === 'schema' ? 'Schema Defined' : 'User Defined') + '</span>';
      var schemaCol = engine.getColumn(crTable, colName);
      if (schemaCol && schemaCol.type) header.innerHTML += '<span class="text-body-secondary small">Data Type: <code>' + esc(schemaCol.type) + '</code></span>';
      box.appendChild(header);
      if (resolved.values && resolved.values.length) { var list = document.createElement('div'); list.className = 'small text-body-secondary'; list.innerHTML = resolved.values.map(function (p) { return esc(p.code) + ' = ' + esc(p.label); }).join('<br>'); box.appendChild(list); }
      else {
        var noneMsg = document.createElement('div'); noneMsg.className = 'small text-body-secondary mb-1'; noneMsg.textContent = 'No predefined decode available.'; box.appendChild(noneMsg);
        var addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'btn btn-outline-primary btn-sm'; addBtn.textContent = '+ Add Decode';
        addBtn.addEventListener('click', function () { var panel = openManualDecodeEditor(crTable, colName, function () {}); panel.classList.remove('d-none'); box.appendChild(panel); });
        box.appendChild(addBtn);
      }
      body.appendChild(box);
    });
  }
  function crRenderRequirementsSummary() {
    var box = $('crRequirementsSummaryBody'); var parts = [];
    var descText = $('crDescriptionInput').value.trim();
    parts.push('<h3 class="h6">Describe What You Need</h3>');
    parts.push(descText ? '<p><em>' + esc(descText) + '</em></p>' : '<p class="text-body-secondary">No description provided.</p>');
    parts.push('<div class="mt-2"><strong>Query Type:</strong> ' + esc(crCommand) + '</div>');
    parts.push('<div><strong>Table:</strong> ' + esc(crTable) + '</div>');
    if (crCommand === 'INSERT') {
      var insCols = Object.keys(crInsertColumns).filter(function (n) { return crInsertColumns[n].checked; });
      parts.push('<div class="mt-2"><strong>Columns:</strong><br>' + (insCols.join('<br>') || '<span class="text-body-secondary">None selected</span>') + '</div>');
      parts.push('<div class="mt-2"><strong>Values:</strong><br>' + insCols.map(function (n) { return n + ' &rarr; ' + esc(crInsertColumns[n].value || ''); }).join('<br>') + '</div>');
    } else if (crCommand === 'UPDATE') {
      var updCols = Object.keys(crUpdateColumns).filter(function (n) { return crUpdateColumns[n].checked; });
      parts.push('<div class="mt-2"><strong>Columns to Update:</strong><br>' + (updCols.join('<br>') || '<span class="text-body-secondary">None selected</span>') + '</div>');
      parts.push('<div class="mt-2"><strong>Values:</strong><br>' + updCols.map(function (n) { return n + ' &rarr; ' + esc(crUpdateColumns[n].value || ''); }).join('<br>') + '</div>');
    }
    if (crCommand === 'UPDATE' || crCommand === 'DELETE' || crCommand === 'SELECT') { var built = APSQL_FILTER.buildWhereSql(crFilterGroup, $('crDialectSel').value); parts.push('<div class="mt-2"><strong>WHERE:</strong><br>' + (built.plainEnglish ? esc(built.plainEnglish) : '<span class="text-body-secondary">None</span>') + '</div>'); }
    box.innerHTML = parts.join('');
  }
  function crRenderAll() {
    $('crInsertPanel').classList.toggle('d-none', crCommand !== 'INSERT'); $('crUpdatePanel').classList.toggle('d-none', crCommand !== 'UPDATE');
    if (crCommand === 'INSERT') crRenderInsertPanel(); if (crCommand === 'UPDATE') crRenderUpdatePanel();
    crRenderWherePanel(); crRenderDecodePanel(); crRenderRequirementsSummary();
  }
  function crRenderResult(res) {
    crLastResult = res; var body = $('crResultBody');
    if (res.status === 'rejected') {
      body.innerHTML = '<div class="alert alert-danger mb-2"><strong>Could not build this query.</strong><br>' + esc(res.message) + '</div>' + renderSuggestedFixes(res.message);
      $('crCopyBtn').classList.add('d-none'); $('crOptimizeBtn').classList.add('d-none'); $('crOptimizeReportBox').innerHTML = '';
      $('crWhereRequiredWarning').classList.toggle('d-none', !res.requiresWhereConfirmation);
      return;
    }
    $('crWhereRequiredWarning').classList.add('d-none');
    var warnings = (res.warnings || []).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('');
    body.innerHTML = '<div class="d-flex align-items-center gap-2 mb-2"><span class="badge text-bg-secondary cr-query-type-badge">Query Type: ' + esc(res.command) + '</span>' + (res.isPreview ? '' : '<span class="badge text-bg-warning-subtle text-warning-emphasis">&#9888;&#65039; Change Request Query</span>') + '</div><pre class="sql-output mb-2">' + highlight(res.sql) + '</pre>' + (warnings ? '<div class="alert alert-warning py-2 small mb-2"><ul class="mb-0">' + warnings + '</ul></div>' : '') + '<div class="small text-body-secondary">Generated SQL only \u2013 this application does not execute database changes.</div>';
    $('crCopyBtn').classList.remove('d-none'); $('crOptimizeBtn').classList.remove('d-none'); $('crOptimizeReportBox').innerHTML = '';
  }
  $('crCopyBtn').addEventListener('click', function () { if (crLastResult && crLastResult.status === 'ok') { navigator.clipboard && navigator.clipboard.writeText(crLastResult.sql); var old = $('crCopyBtn').innerHTML; $('crCopyBtn').innerHTML = '&#9989; Copied'; setTimeout(function () { $('crCopyBtn').innerHTML = old; }, 1300); } });
  $('crOptimizeBtn').addEventListener('click', function () {
    if (!crLastResult || crLastResult.status !== 'ok') return;
    var opt = APSQL_OPTIMIZE.optimizeSql(engine, crLastResult);
    if (opt.hasChanges) { crLastResult = Object.assign({}, crLastResult, { sql: opt.optimizedSql }); crRenderResult(crLastResult); }
    renderOptimizeReport('crOptimizeReportBox', opt);
  });

  function crApplyDescriptionToSelection() {
    var text = $('crDescriptionInput').value.trim();
    if (!text) { $('crDescriptionInterpretationBox').innerHTML = ''; return; }
    var interpretation = APSQL_NLQUERY.interpretCrDescription(text, engine, {});

    if (interpretation.command) {
      crCommand = interpretation.command;
      document.querySelectorAll('.cr-command-option').forEach(function (o) { o.classList.toggle('active', o.getAttribute('data-command') === crCommand); });
    }
    if (interpretation.table && engine.getTable(interpretation.table) && interpretation.table !== crTable) {
      crTable = interpretation.table;
      $('crTableSelect').value = crTable;
      crInsertColumns = {}; crUpdateColumns = {}; crFilterGroup = { conditions: [] };
    }
    if (crCommand === 'INSERT' && interpretation.insertColumns && interpretation.insertColumns.length) {
      interpretation.insertColumns.forEach(function (c) {
        if (!engine.columnExists(crTable, c.name)) return;
        if (!crInsertColumns[c.name]) crInsertColumns[c.name] = { checked: false, value: '' };
        crInsertColumns[c.name].checked = true;
        if (!crInsertColumns[c.name].value) crInsertColumns[c.name].value = c.value;
      });
    }
    if (crCommand === 'UPDATE' && interpretation.updateColumns && interpretation.updateColumns.length) {
      interpretation.updateColumns.forEach(function (c) {
        if (!engine.columnExists(crTable, c.column)) return;
        if (!crUpdateColumns[c.column]) crUpdateColumns[c.column] = { checked: false, value: '' };
        crUpdateColumns[c.column].checked = true;
        if (!crUpdateColumns[c.column].value) crUpdateColumns[c.column].value = c.value;
      });
    }
    if ((crCommand === 'UPDATE' || crCommand === 'DELETE') && interpretation.filterConditions && interpretation.filterConditions.length) {
      crFilterGroup.conditions = APSQL_NLQUERY.mergeFilterConditions(crFilterGroup.conditions, interpretation.filterConditions).map(function (c) {
        return c.id ? c : APSQL_FILTER.newCondition(c);
      });
    }
    crRenderAll();
    renderCrDescriptionInterpretationBox(interpretation);
  }
  function renderCrDescriptionInterpretationBox(interpretation) {
    var box = $('crDescriptionInterpretationBox'); if (!box) return;
    var hasMatched = interpretation.matched && interpretation.matched.length;
    var hasWarnings = interpretation.warnings && interpretation.warnings.length;
    if (!hasMatched && !hasWarnings) { box.innerHTML = ''; return; }
    var parts = [];
    if (hasMatched) parts.push('<strong><i class="bi bi-chat-left-text-fill me-1"></i>Interpreted from your description:</strong><ul class="mt-1 mb-0">' + interpretation.matched.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>');
    if (hasWarnings) parts.push('<div class="' + (hasMatched ? 'mt-2 ' : '') + 'text-body-secondary small">' + interpretation.warnings.map(esc).join('<br>') + '</div>');
    box.innerHTML = '<div class="alert alert-info py-2 mb-0 small">' + parts.join('') + '</div>';
  }

  function runCrBuild() {
    crApplyDescriptionToSelection();
    var request = { command: crCommand, table: crTable, allowNoWhere: $('crAllowNoWhere').checked };
    if (crCommand === 'INSERT') request.columns = Object.keys(crInsertColumns).filter(function (n) { return crInsertColumns[n].checked; }).map(function (n) { return { name: n, value: crInsertColumns[n].value }; });
    else if (crCommand === 'UPDATE') { request.updates = Object.keys(crUpdateColumns).filter(function (n) { return crUpdateColumns[n].checked; }).map(function (n) { return { column: n, value: crUpdateColumns[n].value }; }); request.filterGroup = crFilterGroup; }
    else if (crCommand === 'DELETE' || crCommand === 'SELECT') request.filterGroup = crFilterGroup;
    var res = APSQL_CR.buildCrQuery(engine, request, $('crDialectSel').value);
    crRenderResult(res);
  }
  $('crBuildBtn').addEventListener('click', runCrBuild);
  $('crGenerateFromDescriptionBtn').addEventListener('click', runCrBuild);
  crRefreshTableOptions(); crRenderAll();

  document.querySelectorAll('#crManualTabs .nav-link').forEach(function (t) {
    t.addEventListener('click', function () {
      var name = t.getAttribute('data-cr-tab');
      document.querySelectorAll('#crManualTabs .nav-link').forEach(function (x) { x.classList.toggle('active', x === t); });
      document.querySelectorAll('.tab-pane-cr').forEach(function (p) { var show = p.id === 'cr-pane-' + name; p.classList.toggle('d-none', !show); p.classList.toggle('active', show); });
      if (name === 'requirements') crRenderRequirementsSummary();
    });
  });

  var schemaSearchTerm = '';
  function highlightMatch(text, term) { if (!term) return esc(text); var escText = esc(text); var escTerm = esc(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (!escTerm) return escText; return escText.replace(new RegExp('(' + escTerm + ')', 'ig'), '<mark>$1</mark>'); }
  function tableMatchesSearch(t, term) { if (!term) return true; if ((t.name + ' ' + (t.notes || '')).toLowerCase().indexOf(term) !== -1) return true; return t.columns.some(function (c) { return columnMatchesSearch(c, term); }); }
  function columnMatchesSearch(c, term) { if (!term) return true; return (c.name + ' ' + (c.alias || '') + ' ' + (c.description || '') + ' ' + (c.type || '')).toLowerCase().indexOf(term) !== -1; }
  function renderUsedSchema() {
    var st = engine.getStatus();
    $('usedSchemaSummary').innerHTML = [['Schema', st.schemaName], ['Version', st.schemaVersion], ['Status', '&#9989; Valid / Active'], ['Modules', st.moduleCount], ['Tables', st.tableCount], ['Columns', st.columnCount], ['Last Updated', st.lastUpdated]].map(function (row) { return '<div class="col-6 col-md-4 col-lg-3"><div class="text-body-secondary small">' + row[0] + '</div><div class="fw-semibold">' + row[1] + '</div></div>'; }).join('');
    if (!allTables().length) {
      $('schemaTree').innerHTML = '<div class="alert alert-secondary py-2 mb-0">The active schema currently has no tables. Upload a schema file under Schema &rarr; Update Schema to get started.</div>';
      $('schemaSearchNoResults').classList.remove('show'); $('schemaSearchResultCount').textContent = ''; $('schemaSearchClearBtn').classList.add('d-none');
      return;
    }
    var labels = moduleLabels(); var term = schemaSearchTerm.toLowerCase().trim(); var byModule = {};
    allTables().forEach(function (t) { (byModule[t.module] = byModule[t.module] || []).push(t); });
    var matchedTableCount = 0, matchedColumnCount = 0; var parts = [];
    Object.keys(byModule).sort().forEach(function (mod) {
      var allInModule = byModule[mod]; var matching = term ? allInModule.filter(function (t) { return tableMatchesSearch(t, term); }) : allInModule;
      if (term && !matching.length) return;
      var totalCols = allInModule.reduce(function (s, t) { return s + t.columns.length; }, 0);
      var tablesHtml = matching.map(function (t) {
        matchedTableCount++;
        var colsToShow = term ? t.columns.filter(function (c) { return columnMatchesSearch(c, term); }) : t.columns;
        matchedColumnCount += colsToShow.length;
        var colsHtml = colsToShow.map(function (c) { var badge = c.primary_key ? '<span class="badge text-bg-warning">PK</span>' : (c.foreign_key ? '<span class="badge text-bg-info">FK &rarr; ' + c.foreign_key.table + '.' + c.foreign_key.column + '</span>' : ''); return '<div class="col-item"><code>' + highlightMatch(c.name, term) + '</code> <span class="text-body-secondary">' + esc(c.type) + '</span> ' + badge + '<span class="col-desc">' + highlightMatch(c.description || '', term) + '</span></div>'; }).join('');
        return '<div><div class="schema-tree-table-row" data-table="' + t.name + '"><span><code>' + highlightMatch(t.name, term) + '</code> <span class="text-body-secondary small">(' + colsToShow.length + ' columns)</span></span><span>&#9662;</span></div><div class="schema-tree-columns' + (term ? ' open' : '') + '" id="cols-' + t.name + '">' + colsHtml + '</div></div>';
      }).join('');
      parts.push('<div class="schema-tree-module"><div class="schema-tree-module-header" data-module="' + mod + '"><span>' + highlightMatch(labels[mod] || mod, term) + ' <span class="text-body-secondary small fw-normal">(' + matching.length + ' tables, ' + totalCols + ' columns)</span></span><span>&#9662;</span></div><div class="schema-tree-tables' + (term ? ' open' : '') + '" id="tables-' + mod + '">' + tablesHtml + '</div></div>');
    });
    $('schemaTree').innerHTML = parts.join('');
    $('schemaTree').querySelectorAll('.schema-tree-module-header').forEach(function (h) { h.addEventListener('click', function () { $('tables-' + h.getAttribute('data-module')).classList.toggle('open'); }); });
    $('schemaTree').querySelectorAll('.schema-tree-table-row').forEach(function (r) { r.addEventListener('click', function () { $('cols-' + r.getAttribute('data-table')).classList.toggle('open'); }); });
    $('schemaSearchNoResults').classList.toggle('show', !!(term && matchedTableCount === 0));
    $('schemaSearchResultCount').textContent = term && matchedTableCount ? (matchedTableCount + ' tables and ' + matchedColumnCount + ' columns match "' + schemaSearchTerm + '".') : '';
    $('schemaSearchClearBtn').classList.toggle('d-none', !term);
  }
  $('schemaSearchInput').addEventListener('input', function (e) { schemaSearchTerm = e.target.value; renderUsedSchema(); });
  $('schemaSearchClearBtn').addEventListener('click', function () { $('schemaSearchInput').value = ''; schemaSearchTerm = ''; renderUsedSchema(); });

  var aboutModalEl = $('aboutModal'); var aboutModal = window.bootstrap ? new window.bootstrap.Modal(aboutModalEl) : null;
  $('aboutMenuBtn').addEventListener('click', function () {
    var st = engine.getStatus();
    $('aboutList').innerHTML = [['Application name', 'AP-SQL Assistant'], ['Application version', '10.2.0'], ['Purpose', 'Building read-only SQL and Change Request (INSERT/UPDATE/DELETE) SQL text \u2014 from a plain-language description, manual selections, or both \u2014 correcting SQL queries based on database errors, and syncing schema updates across browsers/devices/users via a linked shared file, all using the organization\'s approved database schema.'], ['Active schema version', st.schemaVersion], ['Schema last updated', st.lastUpdated], ['Security', 'Read-only builder never emits mutating SQL. CR builder and Error Rectifier only ever produce SQL text and never execute it, connect to a database, or modify the active schema. Schema updates, deletions, and manually-defined relationships are password-protected and re-verified before every mutating action. The active schema is saved in this browser, and optionally also synced to a single shared file the administrator explicitly links \u2014 no schema data is ever sent to any other network destination.']].map(function (row) { return '<li class="list-group-item"><span class="text-body-secondary d-block small">' + row[0] + '</span>' + esc(row[1]) + '</li>'; }).join('');
    closeMenu(); if (aboutModal) aboutModal.show(); else aboutModalEl.classList.add('show');
  });

  var WORKFLOW_STEPS = ['Upload Document', 'Read Document', 'Detect Format', 'Detect Modules', 'Detect Tables', 'Detect Columns', 'Extract Metadata', 'Normalize Schema', 'Validate Schema', 'Show Preview', 'User Reviews Changes', 'Generate JSON', 'Validate JSON', 'Apply Schema Update'];
  function renderWorkflowSteps(activeIdx) { $('workflowStepList').innerHTML = WORKFLOW_STEPS.map(function (s, i) { var cls = i < activeIdx ? 'text-bg-success' : (i === activeIdx ? 'text-bg-primary' : 'text-bg-light border'); return '<span class="badge ' + cls + '">' + (i + 1) + '. ' + s + '</span>'; }).join(''); }
  renderWorkflowSteps(0);
  $('updateSchemaPasswordBtn').addEventListener('click', function () { var pw = $('updateSchemaPasswordInput').value; window.APSQL_SCHEMA_TOOLS.verifyPassword(pw).then(function (ok) { if (ok) { $('updateSchemaPasswordStep').classList.add('d-none'); $('updateSchemaWorkArea').classList.remove('d-none'); renderWorkflowSteps(1); renderSyncStatus(); } else $('updateSchemaPasswordError').classList.remove('d-none'); }); });
  function triggerDownload(blob, filename) { var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 2000); }
  $('downloadCurrentJsonBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildCurrentSchemaJsonBlob(currentSchema), 'current-schema.json'); });
  $('downloadCurrentCsvBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildCurrentSchemaCsvBlob(currentSchema), 'current-schema.csv'); });
  $('downloadCurrentDocxBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildCurrentSchemaDocxBlob(currentSchema), 'current-schema.docx'); });
  $('downloadCurrentXlsxBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildCurrentSchemaXlsxBlob(currentSchema), 'current-schema.xlsx'); });
  $('downloadCurrentDocBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildCurrentSchemaDocBlob(currentSchema), 'current-schema.doc'); });
  $('downloadJsonSampleBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildSampleJsonBlob(), 'sample-schema.json'); });
  $('downloadCsvSampleBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildSampleCsvBlob(), 'sample-schema.csv'); });
  $('downloadDocxSampleBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildSampleDocxBlob(), 'sample-schema.docx'); });
  $('downloadXlsxSampleBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildSampleXlsxBlob(), 'sample-schema.xlsx'); });
  $('downloadDocSampleBtn').addEventListener('click', function () { triggerDownload(window.APSQL_SCHEMA_TOOLS.buildSampleDocBlob(), 'sample-schema.doc'); });
  $('toggleExpectedStructureBtn').addEventListener('click', function () { var box = $('expectedStructureBox'); var btn = $('toggleExpectedStructureBtn'); box.classList.toggle('d-none'); btn.innerHTML = box.classList.contains('d-none') ? '<i class="bi bi-search me-1"></i>View Expected Structure' : '<i class="bi bi-search me-1"></i>Hide Expected Structure'; });
  var pendingIncomingTables = null;
  $('updateSchemaFileInput').addEventListener('change', function () { $('unsupportedFormatError').classList.add('d-none'); var file = $('updateSchemaFileInput').files && $('updateSchemaFileInput').files[0]; if (!file) return; if (!window.APSQL_SCHEMA_TOOLS.detectFormat(file.name)) { $('unsupportedFormatError').textContent = 'Unsupported file format. Please upload a .json or .csv file.'; $('unsupportedFormatError').classList.remove('d-none'); $('updateSchemaFileInput').value = ''; } });
  $('updateSchemaProcessBtn').addEventListener('click', function () {
    var file = $('updateSchemaFileInput').files && $('updateSchemaFileInput').files[0];
    var resultBox = $('updateSchemaResult'); resultBox.innerHTML = ''; $('unsupportedFormatError').classList.add('d-none');
    if (!file) { resultBox.innerHTML = '<div class="alert alert-warning py-2 mb-0">Please choose a file first.</div>'; return; }
    if (!window.APSQL_SCHEMA_TOOLS.detectFormat(file.name)) { $('unsupportedFormatError').textContent = 'Unsupported file format. Please upload a .json or .csv file.'; $('unsupportedFormatError').classList.remove('d-none'); return; }
    renderWorkflowSteps(3);
    window.APSQL_SCHEMA_TOOLS.fileToTables(file).then(function (tables) {
      renderWorkflowSteps(8);
      var validation = window.APSQL_SCHEMA_TOOLS.validateSchema(tables);
      $('validationResultBox').innerHTML = validation.valid ? '<div class="alert alert-success py-2 mb-0">&#9989; Schema validated: no duplicate tables/columns, no missing names detected.</div>' : '<div class="alert alert-danger py-2 mb-0"><strong>The schema could not be activated because validation failed. The existing active schema has not been changed.</strong><ul class="mb-0 mt-1">' + validation.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
      if (!validation.valid) { $('updateSchemaPreviewCard').classList.remove('d-none'); return; }
      pendingIncomingTables = tables; renderWorkflowSteps(9);
      var diff = window.APSQL_SCHEMA_TOOLS.computeDiff(currentSchema, tables);
      $('previewCurrentBox').innerHTML = 'Version: ' + esc(currentSchema.schema_version) + '<br>Tables: ' + diff.currentTableCount + '<br>Columns: ' + diff.currentColumnCount;
      $('previewNewBox').innerHTML = 'Version: ' + esc(diff.newVersion) + '<br>Tables: ' + diff.newTableCount + '<br>Columns: ' + diff.newColumnCount;
      $('previewChangesBox').innerHTML = '<span class="diff-added">+ ' + diff.addedTableCount + ' New Tables</span><br><span class="diff-added">+ ' + diff.addedColumnCount + ' New Columns</span><br><span class="diff-updated">~ ' + diff.updatedTableCount + ' Updated Tables</span>';
      $('updateSchemaPreviewCard').classList.remove('d-none'); $('updateSchemaPreviewCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) { resultBox.innerHTML = '<div class="alert alert-danger py-2 mb-0">' + esc(err.message) + '</div>'; renderWorkflowSteps(1); });
  });

  function refreshAllViewsAfterSchemaChange() {
    refreshTablesColumnsUI(); refreshHierarchyOptions(); refreshModuleChips(); crRefreshTableOptions(); crRenderAll();
    if (currentView === 'usedschema') renderUsedSchema();
  }

  function performApplySchemaUpdate() {
    if (!pendingIncomingTables) return;
    var mergeResult = window.APSQL_SCHEMA_TOOLS.mergeSchemas(currentSchema, pendingIncomingTables, $('updateSchemaFileInput').files[0].name);
    currentSchema = mergeResult.schema; rebuildEngine();
    schemaLoadedFromStorage = true; persistCurrentSchema(); renderSchemaPersistenceStatus();
    renderWorkflowSteps(13);
    refreshAllViewsAfterSchemaChange();
    $('updateSchemaResult').innerHTML = '<div class="alert alert-success py-2"><div><strong>' + mergeResult.addedTables.length + '</strong> new table(s), <strong>' + mergeResult.addedColumns.length + '</strong> new column(s) added.</div><div class="mt-2"><code>Schema Version: ' + esc(currentSchema.schema_version) + '</code></div><div class="mt-2">The new schema is now active everywhere in this app \u2014 Used Schema, both Query Builders, Error Rectifier, filters, decode, and validation \u2014 and has been saved in this browser (and to the linked shared file, if one is set up), so it will still be here after a refresh.</div></div>';
    $('updateSchemaPreviewCard').classList.add('d-none'); pendingIncomingTables = null;
  }
  var reauthApplyModalEl = $('reauthApplyModal'); var reauthApplyModal = window.bootstrap ? new window.bootstrap.Modal(reauthApplyModalEl) : null;
  $('activateSchemaBtn').addEventListener('click', function () {
    if (!pendingIncomingTables) return;
    $('reauthApplyPasswordInput').value = ''; $('reauthApplyPasswordError').classList.add('d-none');
    if (reauthApplyModal) reauthApplyModal.show();
  });
  $('confirmReauthApplyBtn').addEventListener('click', function () {
    var pw = $('reauthApplyPasswordInput').value;
    window.APSQL_SCHEMA_TOOLS.verifyPassword(pw).then(function (ok) {
      if (!ok) { $('reauthApplyPasswordError').classList.remove('d-none'); return; }
      if (reauthApplyModal) reauthApplyModal.hide();
      performApplySchemaUpdate();
    });
  });
  $('cancelPreviewBtn').addEventListener('click', function () { $('updateSchemaPreviewCard').classList.add('d-none'); pendingIncomingTables = null; renderWorkflowSteps(1); $('updateSchemaResult').innerHTML = '<div class="alert alert-secondary py-2 mb-0">Update cancelled. The existing active schema has not been changed.</div>'; });

  var deleteSchemaModalEl = $('deleteSchemaModal'); var deleteSchemaModal = window.bootstrap ? new window.bootstrap.Modal(deleteSchemaModalEl) : null;
  $('deleteSchemaBtn').addEventListener('click', function () { $('deleteSchemaPasswordInput').value = ''; $('deleteSchemaPasswordError').classList.add('d-none'); if (deleteSchemaModal) deleteSchemaModal.show(); });
  $('confirmDeleteSchemaBtn').addEventListener('click', function () {
    var pw = $('deleteSchemaPasswordInput').value;
    window.APSQL_SCHEMA_TOOLS.verifyPassword(pw).then(function (ok) {
      if (!ok) { $('deleteSchemaPasswordError').classList.remove('d-none'); return; }
      triggerDownload(window.APSQL_SCHEMA_TOOLS.buildCurrentSchemaJsonBlob(currentSchema), 'schema-backup-before-delete.json');
      currentSchema = window.APSQL_SCHEMA_TOOLS.buildEmptySchema(currentSchema);
      relationshipStore.clearAll(); relationshipDrafts = {};
      rebuildEngine();
      schemaLoadedFromStorage = true; persistCurrentSchema(); renderSchemaPersistenceStatus();
      selectedTables = []; columnState = {}; readOnlyFilterGroup.conditions = [];
      sortRows = []; existsRows = []; scalarRows = [];
      $('optJoinInner').checked = true; syncJoinChoiceHighlight();
      $('optLimit').value = ''; $('optView').value = ''; $('optHaving').value = ''; $('optHierarchy').value = '';
      $('promptInput').value = ''; $('descriptionInterpretationBox').innerHTML = '';
      crInsertColumns = {}; crUpdateColumns = {}; crFilterGroup.conditions = []; $('crDescriptionInput').value = ''; $('crDescriptionInterpretationBox').innerHTML = '';
      refreshAllViewsAfterSchemaChange();
      if (deleteSchemaModal) deleteSchemaModal.hide();
      $('updateSchemaResult').innerHTML = '<div class="alert alert-warning py-2"><strong>The active schema has been deleted.</strong> A backup was automatically downloaded as <code>schema-backup-before-delete.json</code>. Upload a new schema file above to continue, or re-import that backup. If a shared file is linked, it has also been updated to the empty schema.</div>';
    });
  });

  var saveRelationshipModalEl = $('saveRelationshipModal'); var saveRelationshipModal = window.bootstrap ? new window.bootstrap.Modal(saveRelationshipModalEl) : null;
  $('confirmSaveRelationshipBtn').addEventListener('click', function () {
    if (!pendingSaveRelationshipDraft) return;
    var pw = $('saveRelationshipPasswordInput').value;
    window.APSQL_SCHEMA_TOOLS.verifyPassword(pw).then(function (ok) {
      if (!ok) { $('saveRelationshipPasswordError').classList.remove('d-none'); return; }
      var d = pendingSaveRelationshipDraft;
      try { currentSchema = window.APSQL_SCHEMA_TOOLS.saveRelationshipToSchema(currentSchema, d.fromTable, d.fromColumn, d.toTable, d.toColumn); }
      catch (err) { $('saveRelationshipPasswordError').classList.remove('d-none'); $('saveRelationshipPasswordError').textContent = err.message; return; }
      relationshipStore.clearManualRelationship(d.fromTable, d.toTable);
      delete relationshipDrafts[d.fromTable];
      rebuildEngine();
      schemaLoadedFromStorage = true; persistCurrentSchema(); renderSchemaPersistenceStatus();
      refreshAllViewsAfterSchemaChange();
      renderJoinPreview();
      if (saveRelationshipModal) saveRelationshipModal.hide();
      pendingSaveRelationshipDraft = null;
    });
  });

  var errLastResult = null;
  function renderErrorRectifierResult(result) {
    errLastResult = result;
    var sqlBody = $('errRectifiedSqlBody');
    sqlBody.innerHTML = '<pre class="sql-output mb-0">' + highlight(result.correctedSql) + '</pre>';
    $('errCopySqlBtn').classList.remove('d-none');

    var explainBody = $('errExplanationBody');
    explainBody.innerHTML =
      '<div class="explanation-heading"><i class="bi bi-search me-1"></i>Error Identified</div><p class="mb-2">' + esc(result.errorIdentified) + '</p>' +
      '<div class="explanation-heading"><i class="bi bi-check2-circle me-1"></i>Correction Applied</div><p class="mb-0">' + esc(result.correctionApplied) + '</p>';
    $('errCopyExplanationBtn').classList.remove('d-none');

    var changedCard = $('errWhatChangedCard'); var changedBody = $('errWhatChangedBody');
    if (result.changed && result.changes && result.changes.length) {
      changedCard.classList.remove('d-none');
      changedBody.innerHTML = result.changes.map(function (c) {
        return '<div class="change-row"><code class="change-from">' + esc(c.from) + '</code><span class="change-arrow">&rarr;</span><code class="change-to">' + esc(c.to) + '</code></div>';
      }).join('');
    } else {
      changedCard.classList.add('d-none'); changedBody.innerHTML = '';
    }
  }
  $('errRectifyBtn').addEventListener('click', function () {
    var errorText = $('errErrorInput').value;
    var sqlText = $('errSqlInput').value;
    var detected = window.APSQL_ERROR_RECTIFIER.detectDialectFromError(errorText);
    if (detected) $('errDialectSel').value = detected;
    var dialect = $('errDialectSel').value;
    var result = window.APSQL_ERROR_RECTIFIER.rectify(sqlText, errorText, engine, dialect);
    renderErrorRectifierResult(result);
  });
  $('errCopySqlBtn').addEventListener('click', function () {
    if (!errLastResult) return;
    navigator.clipboard && navigator.clipboard.writeText(errLastResult.correctedSql);
    var old = $('errCopySqlBtn').innerHTML; $('errCopySqlBtn').innerHTML = '&#9989; Copied'; setTimeout(function () { $('errCopySqlBtn').innerHTML = old; }, 1300);
  });
  $('errCopyExplanationBtn').addEventListener('click', function () {
    if (!errLastResult) return;
    var text = 'Error Identified: ' + errLastResult.errorIdentified + '\n\nCorrection Applied: ' + errLastResult.correctionApplied;
    navigator.clipboard && navigator.clipboard.writeText(text);
    var old = $('errCopyExplanationBtn').innerHTML; $('errCopyExplanationBtn').innerHTML = '&#9989; Copied'; setTimeout(function () { $('errCopyExplanationBtn').innerHTML = old; }, 1300);
  });

  var TOURS = {
    quickstart: [
      { sel: '[data-tour="hamburger"]', place: 'bottom', title: 'What this application does', body: '<p>This tool writes read-only SQL, Change Request SQL, and helps correct a SQL query when a database gives you back an error.</p>' },
      { sel: '#qsExampleGrid', place: 'top', title: 'Try an example', body: '<p>Click any card to load a ready-made example straight into the Read Only Query Builder.</p>' },
      { sel: '[data-tour="tourbtn"]', place: 'bottom', title: 'Two ways to build a query', body: '<p>Describe what you need in plain language, make selections manually, or combine both.</p>' }
    ],
    builder: [
      { sel: '[data-tour="prompt"]', place: 'bottom', title: 'Describe What You Need', body: '<p>Type a plain-English request here and click Build Query.</p>' },
      { sel: '[data-tour="describe-build"]', place: 'top', title: 'Build Query works right here too', body: '<p>This button and the one below the tabs do exactly the same thing.</p>' },
      { sel: '[data-tour="results"]', place: 'left', title: 'Review, optimize, and copy', body: '<p>The validated SQL appears here.</p>' },
      { sel: '[data-tour="tabs"]', place: 'top', title: 'Tables & Columns, Advanced Options, Requirements', body: '<p>Anything you select manually is combined with your description.</p>' }
    ],
    crbuilder: [
      { sel: '#crCommandSelector', place: 'bottom', title: 'Query Type', body: '<p>Choose INSERT, UPDATE, or DELETE manually, or let your description decide.</p>' },
      { sel: '[data-tour="cr-describe-build"]', place: 'top', title: 'Describe the whole Change Request', body: '<p>Describe the table, values, and WHERE condition all in one sentence.</p>' },
      { sel: '#crResultBody', place: 'left', title: 'Reviewing and copying', body: '<p>The generated SQL appears here.</p>' },
      { sel: '.cr-safety-banner', place: 'bottom', title: 'Safety', body: '<p>This application never executes SQL.</p>' }
    ],
    usedschema: [
      { sel: '#usedSchemaSummary', place: 'bottom', title: 'The currently active schema', body: '<p>This always reflects the schema currently in use.</p>' },
      { sel: '#schemaSearchInput', place: 'bottom', title: 'Search the schema', body: '<p>Type here to filter.</p>' }
    ],
    updateschema: [
      { sel: '#schemaPersistenceStatus', place: 'bottom', title: 'Your schema changes are saved', body: '<p>Saved in this browser.</p>' },
      { sel: '[data-tour="sync-card"]', place: 'bottom', title: 'Syncing across browsers, devices, and users', body: '<p>Link the schema to a single shared file. This needs a Chromium browser.</p>' },
      { sel: '#updateSchemaPasswordStep', place: 'bottom', title: 'Password-protected administrator action', body: '<p>Only authorized users can update the schema.</p>' }
    ],
    errorrectifier: [
      { sel: '[data-tour="err-safety"]', place: 'bottom', title: 'What Error Rectifier does', body: '<p>Helps you fix SQL after a database error.</p>' },
      { sel: '[data-tour="err-errorbox"]', place: 'bottom', title: 'Where to find the database error', body: '<p>Paste the complete error text.</p>' },
      { sel: '[data-tour="err-sqlbox"]', place: 'bottom', title: 'How to enter the current SQL', body: '<p>Paste the exact SQL that produced that error.</p>' },
      { sel: '[data-tour="err-rectifybtn"]', place: 'top', title: 'Selecting the SQL dialect', body: '<p>Auto-detected where possible.</p>' },
      { sel: '[data-tour="err-rectifiedbox"]', place: 'top', title: 'How to rectify the SQL', body: '<p>Click Rectify SQL.</p>' },
      { sel: '[data-tour="err-explanationbox"]', place: 'top', title: 'Reviewing and copying', body: '<p>Always review generated SQL before using it.</p>' }
    ],
    about: []
  };
  var TOUR = TOURS.quickstart; var tourIdx = 0, tourOpen = false;
  var overlay = $('tourOverlay'), spotlight = $('tourSpotlight'), popup = $('tourPopup');
  function clampToViewport(top, left, popW, popH) { var vw = window.innerWidth, vh = window.innerHeight, margin = 12; return { top: Math.min(Math.max(margin, top), Math.max(margin, vh - popH - margin)), left: Math.min(Math.max(margin, left), Math.max(margin, vw - popW - margin)) }; }
  function positionTour() {
    var step = TOUR[tourIdx]; var target = document.querySelector(step.sel); if (!target) { endTour(); return; }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () {
      var r = target.getBoundingClientRect(); var pad = 8;
      spotlight.style.top = (r.top - pad) + 'px'; spotlight.style.left = (r.left - pad) + 'px'; spotlight.style.width = (r.width + pad * 2) + 'px'; spotlight.style.height = (r.height + pad * 2) + 'px';
      var popW = Math.min(popup.offsetWidth || 360, window.innerWidth - 24); var popH = Math.min(popup.offsetHeight || 190, window.innerHeight - 24); var vh = window.innerHeight;
      var place = step.place || 'bottom';
      if (place === 'bottom' && r.bottom + popH + 20 > vh) place = 'top';
      if (place === 'top' && r.top - popH - 20 < 0) place = 'bottom';
      var rawTop, rawLeft;
      if (place === 'bottom') { rawTop = r.bottom + 14; rawLeft = r.left; } else if (place === 'top') { rawTop = r.top - popH - 14; rawLeft = r.left; } else if (place === 'left') { rawLeft = r.left - popW - 14; rawTop = r.top; } else { rawLeft = r.right + 14; rawTop = r.top; }
      var clamped = clampToViewport(rawTop, rawLeft, popW, popH); popup.style.top = clamped.top + 'px'; popup.style.left = clamped.left + 'px';
      $('tourStepLabel').textContent = 'Step ' + (tourIdx + 1) + ' of ' + TOUR.length + ' \u2014 ' + currentView;
      $('tourTitle').textContent = step.title; $('tourBody').innerHTML = step.body;
      $('tourDots').innerHTML = TOUR.map(function (_, i) { return '<i class="' + (i === tourIdx ? 'on' : '') + '"></i>'; }).join('');
      $('tourPrev').disabled = tourIdx === 0; $('tourNext').textContent = tourIdx === TOUR.length - 1 ? 'Done' : 'Next';
    }, 260);
  }
  function startTour() { TOUR = TOURS[currentView] && TOURS[currentView].length ? TOURS[currentView] : TOURS.quickstart; tourIdx = 0; tourOpen = true; overlay.classList.add('show'); positionTour(); }
  function endTour() { tourOpen = false; overlay.classList.remove('show'); }
  function nextTour() { if (tourIdx < TOUR.length - 1) { tourIdx++; positionTour(); } else endTour(); }
  function prevTour() { if (tourIdx > 0) { tourIdx--; positionTour(); } }
  $('tourBtn').addEventListener('click', startTour); $('tourNext').addEventListener('click', nextTour); $('tourPrev').addEventListener('click', prevTour); $('tourSkip').addEventListener('click', endTour);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) endTour(); });
  document.addEventListener('keydown', function (e) { if (!tourOpen) return; if (e.key === 'Escape') endTour(); else if (e.key === 'ArrowRight') nextTour(); else if (e.key === 'ArrowLeft') prevTour(); });
  window.addEventListener('resize', function () { if (tourOpen) positionTour(); });

})();
