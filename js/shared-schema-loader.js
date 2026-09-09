/**
 * shared-schema-loader.js — AP-SQL Assistant Version 10.4 (NEW)
 * ---------------------------------------------------------------------------
 * V10.3 added two ADMINISTRATOR-facing sync mechanisms (File System Access
 * and GitHub Sync via a Personal Access Token) — both require someone to
 * manually configure that specific browser before it benefits from the
 * shared schema. That's appropriate for the person who MANAGES the schema,
 * but it means an ordinary user who just wants to open the Read Only Query
 * Builder or Query Builder for CR on a brand new device/browser would NOT
 * automatically see the shared schema unless they, too, went through that
 * setup — which defeats "use the shared schema on every device, browser."
 *
 * This module closes that gap with a zero-configuration, read-only
 * auto-load: on every page load (and periodically thereafter), the app
 * does a plain, UNAUTHENTICATED fetch() of a well-known JSON file path,
 * resolved RELATIVE to wherever index.html itself is being served from
 * (e.g. a GitHub Pages site). Because this is a same-origin static-file
 * request:
 *   - It works in literally every browser (no CORS, no auth, no rate
 *     limits beyond ordinary static hosting).
 *   - It requires ZERO setup on the consuming device/browser — the very
 *     first time ANYONE opens the app anywhere, they automatically get
 *     whatever schema has been published at that location.
 *   - It gracefully, silently falls back to whatever schema the app
 *     already had (embedded default, or a previously cached one) if the
 *     file is missing (404), unreachable (e.g. opened via file:// where
 *     fetch of local files is blocked by the browser), or invalid.
 *
 * The administrator "publishes" a schema for everyone simply by making
 * sure their GitHub Sync (github-sync-engine.js, V10.3) file path matches
 * this same well-known location — which is now the default suggested path
 * in the Update Schema UI. Once GitHub Pages rebuilds after that commit
 * (usually well under a minute), every device/browser that opens the app
 * will pick it up automatically on its next load or periodic check.
 *
 * Design notes:
 *   - `fetchImpl` is injectable (defaults to the real global `fetch`), so
 *     this whole module is unit-testable with a fake fetch, exactly like
 *     github-sync-engine.js.
 *   - A cache-busting query parameter is always appended, since GitHub
 *     Pages (and many static hosts/CDNs) apply aggressive caching to
 *     static assets by default, which would otherwise make the periodic
 *     re-check pointless.
 *   - This module NEVER sends any credentials anywhere — it's a plain,
 *     public GET, by design, so it works for every anonymous visitor.
 * ---------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var DEFAULT_SHARED_SCHEMA_PATH = 'schema/shared-schema.json';

  function buildFetchUrl(basePath) {
    var path = basePath || DEFAULT_SHARED_SCHEMA_PATH;
    var sep = path.indexOf('?') === -1 ? '?' : '&';
    return path + sep + 't=' + Date.now();
  }

  /**
   * fetchSharedSchema(basePath, fetchImpl) — plain unauthenticated GET of
   * the shared schema file. Resolves to:
   *   { found: true,  schema, rawText }   — file found and parsed OK
   *   { found: false }                    — file does not exist (404) —
   *                                          NOT treated as an error.
   * Rejects only for genuinely exceptional cases: a non-404 HTTP error
   * status, or a 200 response whose body isn't valid schema JSON. Network
   * errors (offline, CORS-blocked file:// access, etc.) are surfaced as a
   * rejection too, so the caller can decide how loudly (or quietly) to
   * report them — the recommended, and default, caller behavior (see
   * app.js) is to fail silently and keep whatever schema was already
   * active, since this is a best-effort convenience feature, not a
   * required one.
   */
  function fetchSharedSchema(basePath, fetchImpl) {
    fetchImpl = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchImpl) return Promise.reject(new Error('The fetch API is not available in this environment.'));
    var url = buildFetchUrl(basePath);
    return fetchImpl(url, { cache: 'no-store' }).then(function (res) {
      if (res.status === 404) return { found: false };
      if (!res.ok) return Promise.reject(new Error('The shared schema file could not be read (HTTP ' + res.status + ').'));
      return res.text().then(function (rawText) {
        var parsed;
        try { parsed = JSON.parse(rawText); } catch (e) { return Promise.reject(new Error('The shared schema file does not contain valid JSON.')); }
        var tables = Array.isArray(parsed) ? parsed : parsed.tables;
        if (!Array.isArray(tables)) return Promise.reject(new Error('The shared schema file does not look like a valid AP-SQL Assistant schema.'));
        return { found: true, schema: parsed, rawText: rawText };
      });
    }, function (err) { return Promise.reject(new Error('Could not reach the shared schema file (' + (err && err.message ? err.message : 'network error') + ').')); });
  }

  /**
   * describeSharedSchemaStatus(state) — pure function turning a small
   * state object into a plain-language {level, text}, for consistent UI
   * treatment alongside the other two sync mechanisms' status describers.
   * `state` shape: { checked: bool, found: bool, error: string|null,
   *                   path: string, lastAppliedAt: Date|null }
   */
  function describeSharedSchemaStatus(state) {
    state = state || {};
    if (!state.checked) return { level: 'checking', text: 'Checking for a shared schema at "' + (state.path || DEFAULT_SHARED_SCHEMA_PATH) + '"\u2026' };
    if (state.error) return { level: 'error', text: 'Could not check for a shared schema: ' + state.error };
    if (!state.found) return { level: 'notfound', text: 'No shared schema was found at "' + (state.path || DEFAULT_SHARED_SCHEMA_PATH) + '" (relative to this page). Using the schema already saved in this browser instead. If your organization publishes a shared schema at this location, every device and browser will automatically pick it up from here \u2014 no setup needed.' };
    return { level: 'live', text: 'Using the live shared schema published at "' + (state.path || DEFAULT_SHARED_SCHEMA_PATH) + '". This works automatically on every device and browser that opens this app \u2014 no setup needed.' };
  }

  var API = {
    DEFAULT_SHARED_SCHEMA_PATH: DEFAULT_SHARED_SCHEMA_PATH,
    buildFetchUrl: buildFetchUrl,
    fetchSharedSchema: fetchSharedSchema,
    describeSharedSchemaStatus: describeSharedSchemaStatus
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.APSQL_SHARED_SCHEMA = API;
})(typeof window !== 'undefined' ? window : this);
