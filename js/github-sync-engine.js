/**
 * github-sync-engine.js — AP-SQL Assistant Version 10.3 (NEW)
 * ---------------------------------------------------------------------------
 * V10.2 added Cross-Device Schema Sync via the browser's File System Access
 * API — but that only works in Chromium browsers (Chrome/Edge/etc.), and
 * requires manually picking a shared file location (SharePoint/OneDrive/a
 * network drive). It does NOT help if the app itself is hosted as a plain
 * static site (e.g. GitHub Pages), where there is no server component of
 * any kind, and users may be on Firefox or Safari too.
 *
 * Since GitHub already hosts this application, this module uses GitHub
 * itself as the sync backend: the active schema is read from, and written
 * to, a single JSON file inside a GitHub repository via GitHub's ordinary
 * REST "Contents" API (https://docs.github.com/en/rest/repos/contents).
 * This works in ANY modern browser (Chrome, Edge, Firefox, Safari) because
 * it is nothing more than a small number of authenticated fetch() calls —
 * no browser-specific API is required. Any user, on any device, who is
 * configured to point at the same repo/path/branch will see the same
 * schema, making this a natural fit for a GitHub Pages-hosted deployment.
 *
 * Design notes:
 *   - Every network call goes through an injectable `fetchImpl` parameter
 *     (defaulting to the real global `fetch`), so this entire module is
 *     unit-testable with a fake fetch implementation, exactly like
 *     schema-sync-engine.js is tested with a fake IndexedDB.
 *   - Base64 encode/decode is implemented from scratch (no reliance on
 *     atob/btoa, which are not guaranteed to exist identically across
 *     every JS environment) so this module behaves identically in the
 *     browser and under Node during testing — consistent with this
 *     project's existing "no external dependencies" convention (see the
 *     hand-rolled SHA-256 and ZIP writer in schema-tools.js).
 *   - This module NEVER stores or transmits the schema or the user's
 *     Personal Access Token anywhere except directly to api.github.com
 *     over HTTPS. Persisting the token itself (so the user need not
 *     re-enter it every session) is left to the caller (app.js), which
 *     uses ordinary localStorage — the same tradeoff already accepted for
 *     other settings in this app, and clearly disclosed in the UI.
 *   - Concurrency is handled via GitHub's own optimistic-concurrency
 *     mechanism: every file read returns a `sha`; every write must supply
 *     the `sha` of the version being replaced (omitted only when creating
 *     a brand new file), and GitHub rejects a write with 409 if the file
 *     has changed since that sha was read — signaled here as
 *     { conflict: true } so the caller can re-fetch and retry.
 * ---------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------------
     Base64 <-> bytes, implemented from scratch (UTF-8 safe via
     TextEncoder/TextDecoder), so this module has zero dependency on
     btoa/atob or any Node-specific Buffer API.
     --------------------------------------------------------------------- */
  var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function base64EncodeBytes(bytes) {
    var out = ''; var i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64_CHARS[(n >>> 18) & 63] + B64_CHARS[(n >>> 12) & 63] + B64_CHARS[(n >>> 6) & 63] + B64_CHARS[n & 63];
    }
    var remaining = bytes.length - i;
    if (remaining === 1) {
      var n1 = bytes[i] << 16;
      out += B64_CHARS[(n1 >>> 18) & 63] + B64_CHARS[(n1 >>> 12) & 63] + '==';
    } else if (remaining === 2) {
      var n2 = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += B64_CHARS[(n2 >>> 18) & 63] + B64_CHARS[(n2 >>> 12) & 63] + B64_CHARS[(n2 >>> 6) & 63] + '=';
    }
    return out;
  }
  function base64DecodeToBytes(b64) {
    var clean = String(b64 || '').replace(/[\r\n\s]/g, '');
    var lookup = {};
    for (var i = 0; i < B64_CHARS.length; i++) lookup[B64_CHARS[i]] = i;
    var padCount = 0;
    if (clean.endsWith('==')) padCount = 2; else if (clean.endsWith('=')) padCount = 1;
    var cleanNoPad = clean.replace(/=+$/, '');
    var byteLen = Math.floor((cleanNoPad.length * 6) / 8);
    var bytes = new Uint8Array(byteLen);
    var bitBuffer = 0, bitCount = 0, byteIdx = 0;
    for (var j = 0; j < cleanNoPad.length; j++) {
      var val = lookup[cleanNoPad[j]];
      if (val === undefined) continue;
      bitBuffer = (bitBuffer << 6) | val;
      bitCount += 6;
      if (bitCount >= 8) {
        bitCount -= 8;
        bytes[byteIdx++] = (bitBuffer >>> bitCount) & 0xFF;
      }
    }
    return bytes;
  }
  function utf8ToBase64(str) { return base64EncodeBytes(new TextEncoder().encode(String(str))); }
  function base64ToUtf8(b64) { return new TextDecoder().decode(base64DecodeToBytes(b64)); }

  /* ---------------------------------------------------------------------
     Connection config persistence (owner/repo/path/branch/token). Storage
     is injectable so this is fully testable with a fake in-memory store;
     app.js supplies the real localStorage.
     --------------------------------------------------------------------- */
  var CONFIG_STORAGE_KEY = 'ap_sql_github_sync_v1';
  function createConfigStore(storageImpl) {
    storageImpl = storageImpl || (typeof localStorage !== 'undefined' ? localStorage : null);
    function saveConfig(config) {
      if (!storageImpl) return;
      storageImpl.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
    function loadConfig() {
      if (!storageImpl) return null;
      var raw = storageImpl.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    }
    function clearConfig() {
      if (!storageImpl) return;
      if (typeof storageImpl.removeItem === 'function') storageImpl.removeItem(CONFIG_STORAGE_KEY);
      else storageImpl.setItem(CONFIG_STORAGE_KEY, '');
    }
    return { saveConfig: saveConfig, loadConfig: loadConfig, clearConfig: clearConfig };
  }

  function isConfigComplete(config) {
    return !!(config && config.owner && config.repo && config.path && config.token);
  }
  function normalizeBranch(config) { return (config && config.branch) ? config.branch : 'main'; }

  function buildContentsUrl(config) {
    var branch = normalizeBranch(config);
    return 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' + encodeURIComponent(config.repo) +
      '/contents/' + config.path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(branch);
  }
  function buildContentsWriteUrl(config) {
    return 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' + encodeURIComponent(config.repo) +
      '/contents/' + config.path.split('/').map(encodeURIComponent).join('/');
  }
  function authHeaders(config) {
    return { Authorization: 'Bearer ' + config.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  }

  /**
   * fetchRemoteSchema(config, fetchImpl) — GET the configured file.
   * Resolves to:
   *   { exists: true,  schema, sha }         — file found and parsed OK
   *   { exists: false }                      — file does not exist yet (404)
   * Rejects with a clear Error for auth failures, permission errors,
   * network errors, or a file that exists but isn't valid schema JSON.
   */
  function fetchRemoteSchema(config, fetchImpl) {
    fetchImpl = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchImpl) return Promise.reject(new Error('The fetch API is not available in this environment.'));
    if (!isConfigComplete(config)) return Promise.reject(new Error('GitHub sync is not fully configured (repository owner, name, file path, and a Personal Access Token are all required).'));
    return fetchImpl(buildContentsUrl(config), { headers: authHeaders(config) }).then(function (res) {
      if (res.status === 404) return { exists: false };
      if (res.status === 401) return Promise.reject(new Error('GitHub rejected the Personal Access Token (401 Unauthorized). Double-check the token and that it hasn\u2019t expired.'));
      if (res.status === 403) return Promise.reject(new Error('GitHub denied access to this repository (403 Forbidden). The token may be missing the required Contents permission, or you may have hit a rate limit.'));
      if (!res.ok) return Promise.reject(new Error('GitHub returned an unexpected error (HTTP ' + res.status + ') while reading the schema file.'));
      return res.json().then(function (body) {
        if (Array.isArray(body)) return Promise.reject(new Error('The configured path points to a folder, not a file. Please point to a specific .json file.'));
        var decoded;
        try { decoded = base64ToUtf8(body.content); } catch (e) { return Promise.reject(new Error('Could not decode the contents of the linked schema file.')); }
        var parsed;
        try { parsed = JSON.parse(decoded); } catch (e) { return Promise.reject(new Error('The linked schema file does not contain valid JSON.')); }
        var tables = Array.isArray(parsed) ? parsed : parsed.tables;
        if (!Array.isArray(tables)) return Promise.reject(new Error('The linked file does not look like a valid AP-SQL Assistant schema.'));
        return { exists: true, schema: parsed, sha: body.sha };
      });
    }, function () { return Promise.reject(new Error('Could not reach GitHub (network error). Check your internet connection and try again.')); });
  }

  /**
   * pushSchemaToGitHub(config, schemaObj, sha, fetchImpl) — PUT the schema
   * as the configured file's new content. Pass `sha` from the most recent
   * fetchRemoteSchema() result; omit/pass null to create the file for the
   * first time. Resolves to { sha: newSha }. Rejects with { conflict: true,
   * message } specifically when GitHub reports 409 (someone else changed
   * the file since this sha was read) so callers can re-fetch and retry;
   * rejects with a plain Error (no .conflict) for every other failure.
   */
  function pushSchemaToGitHub(config, schemaObj, sha, fetchImpl) {
    fetchImpl = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchImpl) return Promise.reject(new Error('The fetch API is not available in this environment.'));
    if (!isConfigComplete(config)) return Promise.reject(new Error('GitHub sync is not fully configured (repository owner, name, file path, and a Personal Access Token are all required).'));
    var body = {
      message: 'Update AP-SQL Assistant schema (' + new Date().toISOString() + ')',
      content: utf8ToBase64(JSON.stringify(schemaObj, null, 2)),
      branch: normalizeBranch(config)
    };
    if (sha) body.sha = sha;
    return fetchImpl(buildContentsWriteUrl(config), {
      method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders(config)), body: JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 409) { var err = new Error('Someone else updated the shared schema file since this browser last checked it.'); err.conflict = true; return Promise.reject(err); }
      if (res.status === 401) return Promise.reject(new Error('GitHub rejected the Personal Access Token (401 Unauthorized).'));
      if (res.status === 403) return Promise.reject(new Error('GitHub denied this write (403 Forbidden). The token may be missing the required Contents: Read and write permission.'));
      if (res.status === 422) return Promise.reject(new Error('GitHub rejected this update (422) \u2014 the repository, branch, or file path may not be valid.'));
      if (res.status !== 200 && res.status !== 201) return Promise.reject(new Error('GitHub returned an unexpected error (HTTP ' + res.status + ') while writing the schema file.'));
      return res.json().then(function (respBody) { return { sha: respBody.content && respBody.content.sha }; });
    }, function () { return Promise.reject(new Error('Could not reach GitHub (network error). Check your internet connection and try again.')); });
  }

  /**
   * describeGitHubSyncStatus(state) — pure function turning a small state
   * object into a plain-language {level, text}, mirroring
   * schema-sync-engine.js's describeSyncStatus() for visual/behavioral
   * consistency between the two sync mechanisms.
   */
  function describeGitHubSyncStatus(state) {
    state = state || {};
    if (state.error) return { level: 'error', text: state.error };
    if (!state.configured) return { level: 'unconfigured', text: 'Not set up yet. Enter your repository details and a Personal Access Token below, then click Connect to start syncing the schema through GitHub \u2014 this works in any browser, which is ideal when this app itself is hosted on GitHub Pages.' };
    if (state.conflict) return { level: 'conflict', text: 'Someone else updated the shared schema file on GitHub since this browser last checked it. Click "Sync Now" to fetch the latest version.' };
    return { level: 'connected', text: 'Connected to ' + state.owner + '/' + state.repo + ' \u2014 ' + state.path + ' (branch: ' + (state.branch || 'main') + '). Every Apply / Delete / Save Relationship action also updates this file, and this browser automatically checks it for changes made elsewhere.' };
  }

  var API = {
    base64EncodeBytes: base64EncodeBytes, base64DecodeToBytes: base64DecodeToBytes,
    utf8ToBase64: utf8ToBase64, base64ToUtf8: base64ToUtf8,
    createConfigStore: createConfigStore, isConfigComplete: isConfigComplete, normalizeBranch: normalizeBranch,
    buildContentsUrl: buildContentsUrl, buildContentsWriteUrl: buildContentsWriteUrl,
    fetchRemoteSchema: fetchRemoteSchema, pushSchemaToGitHub: pushSchemaToGitHub,
    describeGitHubSyncStatus: describeGitHubSyncStatus
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.APSQL_GITHUB_SYNC = API;
})(typeof window !== 'undefined' ? window : this);
