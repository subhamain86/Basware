'use strict';
var path = require('path');
var S = require(path.join(__dirname, '..', 'js', 'shared-schema-loader.js'));

function fakeFetch(status, bodyText, opts) {
  opts = opts || {};
  return function () {
    if (opts.networkError) return Promise.reject(new Error(opts.networkErrorMessage || 'simulated offline'));
    return Promise.resolve({ status: status, ok: status >= 200 && status < 300, text: function () { return Promise.resolve(bodyText); } });
  };
}

test('buildFetchUrl uses the default path when none is supplied', function () {
  assertIncludes(S.buildFetchUrl(), 'schema/shared-schema.json');
});
test('buildFetchUrl appends a cache-busting timestamp query param', function () {
  var url = S.buildFetchUrl('schema/shared-schema.json');
  assertTrue(/\?t=\d+$/.test(url));
});
test('buildFetchUrl appends the cache-buster with "&" if the path already has a query string', function () {
  var url = S.buildFetchUrl('schema/shared-schema.json?v=2');
  assertIncludes(url, 'schema/shared-schema.json?v=2&t=');
});
test('buildFetchUrl respects a fully custom path', function () {
  assertIncludes(S.buildFetchUrl('custom/path/my-schema.json'), 'custom/path/my-schema.json?t=');
});

test('fetchSharedSchema resolves {found:false} for a 404 (no shared schema published yet) — not treated as an error', function () {
  return S.fetchSharedSchema('schema/shared-schema.json', fakeFetch(404, '')).then(function (result) {
    assertEqual(result.found, false);
  });
});
test('fetchSharedSchema resolves the parsed schema for a valid 200 response', function () {
  var body = JSON.stringify({ schema_name: 'Shared Org Schema', schema_version: '3.1', tables: [{ name: 'T', columns: [{ name: 'C' }] }] });
  return S.fetchSharedSchema('schema/shared-schema.json', fakeFetch(200, body)).then(function (result) {
    assertTrue(result.found);
    assertEqual(result.schema.schema_name, 'Shared Org Schema');
  });
});
test('fetchSharedSchema accepts a bare array-of-tables JSON shape too', function () {
  var body = JSON.stringify([{ name: 'T', columns: [{ name: 'C' }] }]);
  return S.fetchSharedSchema('schema/shared-schema.json', fakeFetch(200, body)).then(function (result) {
    assertTrue(result.found);
    assertTrue(Array.isArray(result.schema));
  });
});
test('fetchSharedSchema rejects clearly on a non-404 HTTP error status (e.g. 500)', function () {
  return S.fetchSharedSchema('schema/shared-schema.json', fakeFetch(500, '')).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'HTTP 500'); });
});
test('fetchSharedSchema rejects clearly when the response body is not valid JSON', function () {
  return S.fetchSharedSchema('schema/shared-schema.json', fakeFetch(200, 'not valid json{{{')).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'valid JSON'); });
});
test('fetchSharedSchema rejects clearly when the JSON has no tables array at all', function () {
  return S.fetchSharedSchema('schema/shared-schema.json', fakeFetch(200, JSON.stringify({ foo: 'bar' }))).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'valid AP-SQL Assistant schema'); });
});
test('fetchSharedSchema rejects with a network-error message when fetch itself rejects (offline, blocked file://, etc.)', function () {
  return S.fetchSharedSchema('schema/shared-schema.json', fakeFetch(200, '', { networkError: true, networkErrorMessage: 'Failed to fetch' })).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'Could not reach the shared schema file'); assertIncludes(err.message, 'Failed to fetch'); });
});
test('fetchSharedSchema rejects with a clear message when fetch is entirely unavailable (no global fetch, no injected fetchImpl)', function () {
  var realFetch = global.fetch;
  delete global.fetch;
  return S.fetchSharedSchema('schema/shared-schema.json', null).then(
    function () { global.fetch = realFetch; throw new Error('expected rejection'); },
    function (err) { global.fetch = realFetch; assertIncludes(err.message, 'fetch API is not available'); }
  );
});
test('fetchSharedSchema always requests with cache: no-store, so periodic re-checks never see a stale cached copy', function () {
  var capturedInit = null;
  var fetchImpl = function (url, init) { capturedInit = init; return Promise.resolve({ status: 404, ok: false, text: function () { return Promise.resolve(''); } }); };
  return S.fetchSharedSchema('schema/shared-schema.json', fetchImpl).then(function () {
    assertEqual(capturedInit.cache, 'no-store');
  });
});

test('describeSharedSchemaStatus: not yet checked', function () {
  assertEqual(S.describeSharedSchemaStatus({ checked: false }).level, 'checking');
});
test('describeSharedSchemaStatus: an explicit error takes priority once checked', function () {
  var d = S.describeSharedSchemaStatus({ checked: true, error: 'Network unreachable.' });
  assertEqual(d.level, 'error');
  assertIncludes(d.text, 'Network unreachable.');
});
test('describeSharedSchemaStatus: checked, but nothing published there yet', function () {
  var d = S.describeSharedSchemaStatus({ checked: true, found: false, path: 'schema/shared-schema.json' });
  assertEqual(d.level, 'notfound');
  assertIncludes(d.text, 'schema/shared-schema.json');
});
test('describeSharedSchemaStatus: checked and found — live shared schema in use', function () {
  var d = S.describeSharedSchemaStatus({ checked: true, found: true, path: 'schema/shared-schema.json' });
  assertEqual(d.level, 'live');
  assertIncludes(d.text, 'every device and browser');
});
test('describeSharedSchemaStatus handles a completely empty state object without throwing', function () {
  assertEqual(S.describeSharedSchemaStatus({}).level, 'checking');
});

test('end-to-end: a brand new device/browser with zero prior configuration still picks up a schema published at the well-known path', function () {
  var publishedSchema = { schema_name: 'Company-Wide AP Schema', schema_version: '5.0', tables: [{ name: 'IA_INVOICE', module: 'IA', columns: [{ name: 'INVOICE_ID', type: 'INTEGER', primary_key: true }] }] };
  var fetchImpl = fakeFetch(200, JSON.stringify(publishedSchema));
  return S.fetchSharedSchema(undefined, fetchImpl).then(function (result) {
    assertTrue(result.found);
    assertEqual(result.schema.schema_name, 'Company-Wide AP Schema');
    assertEqual(result.schema.tables[0].name, 'IA_INVOICE');
  });
});
