'use strict';
var path = require('path');
var G = require(path.join(__dirname, '..', 'js', 'github-sync-engine.js'));

function makeFakeGitHubFetch(opts) {
  opts = opts || {};
  var store = { content: opts.initialContent || null, sha: opts.initialSha || null };
  var forcedStatus = null;
  var calls = [];
  function fetchImpl(url, init) {
    calls.push({ url: url, init: init });
    if (forcedStatus != null) { var s = forcedStatus; forcedStatus = null; return Promise.resolve(fakeResponse(s, {})); }
    var method = (init && init.method) || 'GET';
    if (method === 'GET') {
      if (store.content == null) return Promise.resolve(fakeResponse(404, {}));
      return Promise.resolve(fakeResponse(200, { content: G.utf8ToBase64(store.content), sha: store.sha, encoding: 'base64' }));
    }
    if (method === 'PUT') {
      var body = JSON.parse(init.body);
      if (store.content != null && body.sha !== store.sha) return Promise.resolve(fakeResponse(409, {}));
      var newSha = 'sha-' + (calls.length);
      store.content = G.base64ToUtf8(body.content);
      store.sha = newSha;
      return Promise.resolve(fakeResponse(store.sha === newSha && calls.length === 1 ? 201 : 200, { content: { sha: newSha } }));
    }
    return Promise.resolve(fakeResponse(500, {}));
  }
  function fakeResponse(status, jsonBody) {
    return { status: status, ok: status >= 200 && status < 300, json: function () { return Promise.resolve(jsonBody); } };
  }
  fetchImpl._store = store;
  fetchImpl._calls = calls;
  fetchImpl._forceNextStatus = function (status) { forcedStatus = status; };
  return fetchImpl;
}
function makeFakeStorage() {
  var data = {};
  return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; }, setItem: function (k, v) { data[k] = String(v); }, removeItem: function (k) { delete data[k]; } };
}
var VALID_CONFIG = { owner: 'acme-corp', repo: 'ap-sql-schema-store', path: 'ap-sql-assistant-schema.json', branch: 'main', token: 'ghp_faketoken123' };

test('base64EncodeBytes/base64DecodeToBytes round-trips arbitrary byte sequences', function () {
  var bytes = new Uint8Array([0, 1, 2, 254, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
  var decoded = G.base64DecodeToBytes(G.base64EncodeBytes(bytes));
  assertEqual(Array.from(decoded), Array.from(bytes));
});
test('utf8ToBase64/base64ToUtf8 round-trips unicode text correctly', function () {
  var text = 'Alusta Single-Sign-On (déprécié) — 日本語テスト';
  assertEqual(G.base64ToUtf8(G.utf8ToBase64(text)), text);
});
test('base64ToUtf8 tolerates newline-wrapped base64 (as GitHub\u2019s API actually returns it)', function () {
  var text = 'a simple schema payload';
  var b64 = G.utf8ToBase64(text);
  var wrapped = b64.match(/.{1,4}/g).join('\n');
  assertEqual(G.base64ToUtf8(wrapped), text);
});

test('createConfigStore: loadConfig returns null when nothing saved yet', function () {
  var store = G.createConfigStore(makeFakeStorage());
  assertEqual(store.loadConfig(), null);
});
test('createConfigStore: saveConfig then loadConfig round-trips the exact config object', function () {
  var store = G.createConfigStore(makeFakeStorage());
  store.saveConfig(VALID_CONFIG);
  assertEqual(store.loadConfig(), VALID_CONFIG);
});
test('createConfigStore: clearConfig removes a previously saved config', function () {
  var store = G.createConfigStore(makeFakeStorage());
  store.saveConfig(VALID_CONFIG);
  store.clearConfig();
  assertEqual(store.loadConfig(), null);
});
test('createConfigStore: loadConfig returns null gracefully for corrupted JSON', function () {
  var storage = makeFakeStorage();
  storage.setItem('ap_sql_github_sync_v1', 'not valid json{{{');
  var store = G.createConfigStore(storage);
  assertEqual(store.loadConfig(), null);
});

test('isConfigComplete is true only when owner, repo, path, and token are all present', function () {
  assertTrue(G.isConfigComplete(VALID_CONFIG));
  assertFalse(G.isConfigComplete({ owner: 'x', repo: 'y', path: 'z.json' }));
  assertFalse(G.isConfigComplete(null));
  assertFalse(G.isConfigComplete({}));
});
test('normalizeBranch defaults to "main" when no branch is specified', function () {
  assertEqual(G.normalizeBranch({}), 'main');
  assertEqual(G.normalizeBranch({ branch: 'develop' }), 'develop');
});
test('buildContentsUrl produces the correct GitHub Contents API GET URL, including the ref query param', function () {
  var url = G.buildContentsUrl(VALID_CONFIG);
  assertIncludes(url, 'https://api.github.com/repos/acme-corp/ap-sql-schema-store/contents/ap-sql-assistant-schema.json');
  assertIncludes(url, 'ref=main');
});
test('buildContentsUrl URL-encodes path segments with special characters', function () {
  var url = G.buildContentsUrl({ owner: 'acme-corp', repo: 'repo', path: 'a folder/schema file.json', branch: 'main', token: 'x' });
  assertIncludes(url, 'a%20folder/schema%20file.json');
});

test('fetchRemoteSchema resolves {exists:false} for a 404 (file does not exist yet)', function () {
  var fetchImpl = makeFakeGitHubFetch({});
  return G.fetchRemoteSchema(VALID_CONFIG, fetchImpl).then(function (result) { assertEqual(result.exists, false); });
});
test('fetchRemoteSchema resolves the parsed schema and sha for a valid existing file', function () {
  var schemaJson = JSON.stringify({ schema_name: 'Test', tables: [{ name: 'T', columns: [{ name: 'C' }] }] });
  var fetchImpl = makeFakeGitHubFetch({ initialContent: schemaJson, initialSha: 'abc123' });
  return G.fetchRemoteSchema(VALID_CONFIG, fetchImpl).then(function (result) {
    assertTrue(result.exists);
    assertEqual(result.schema.schema_name, 'Test');
    assertEqual(result.sha, 'abc123');
  });
});
test('fetchRemoteSchema rejects with a clear message on 401 (bad token)', function () {
  var fetchImpl = makeFakeGitHubFetch({ initialContent: '{}', initialSha: 's' });
  fetchImpl._forceNextStatus(401);
  return G.fetchRemoteSchema(VALID_CONFIG, fetchImpl).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'Unauthorized'); });
});
test('fetchRemoteSchema rejects with a clear message on 403 (permission/rate-limit)', function () {
  var fetchImpl = makeFakeGitHubFetch({ initialContent: '{}', initialSha: 's' });
  fetchImpl._forceNextStatus(403);
  return G.fetchRemoteSchema(VALID_CONFIG, fetchImpl).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'Forbidden'); });
});
test('fetchRemoteSchema rejects clearly when the file exists but is not valid JSON', function () {
  var fetchImpl = makeFakeGitHubFetch({ initialContent: 'not valid json{{{', initialSha: 's' });
  return G.fetchRemoteSchema(VALID_CONFIG, fetchImpl).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'valid JSON'); });
});
test('fetchRemoteSchema rejects clearly when the file exists but has no tables array', function () {
  var fetchImpl = makeFakeGitHubFetch({ initialContent: JSON.stringify({ foo: 'bar' }), initialSha: 's' });
  return G.fetchRemoteSchema(VALID_CONFIG, fetchImpl).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'valid AP-SQL Assistant schema'); });
});
test('fetchRemoteSchema rejects when config is incomplete, without making any network call', function () {
  var fetchImpl = makeFakeGitHubFetch({});
  return G.fetchRemoteSchema({ owner: 'x' }, fetchImpl).then(function () { throw new Error('expected rejection'); }, function (err) {
    assertIncludes(err.message, 'not fully configured');
    assertEqual(fetchImpl._calls.length, 0);
  });
});
test('fetchRemoteSchema rejects with a network-error message when fetch itself rejects', function () {
  var failingFetch = function () { return Promise.reject(new Error('simulated DNS failure')); };
  return G.fetchRemoteSchema(VALID_CONFIG, failingFetch).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'network error'); });
});

test('pushSchemaToGitHub creates a brand-new file (no prior sha) and returns the new sha', function () {
  var fetchImpl = makeFakeGitHubFetch({});
  return G.pushSchemaToGitHub(VALID_CONFIG, { schema_name: 'New', tables: [] }, null, fetchImpl).then(function (result) {
    assertTrue(!!result.sha);
    assertEqual(JSON.parse(fetchImpl._store.content).schema_name, 'New');
  });
});
test('pushSchemaToGitHub updates an existing file when the correct current sha is supplied', function () {
  var fetchImpl = makeFakeGitHubFetch({ initialContent: JSON.stringify({ schema_name: 'Old', tables: [] }), initialSha: 'sha-old' });
  return G.pushSchemaToGitHub(VALID_CONFIG, { schema_name: 'Updated', tables: [] }, 'sha-old', fetchImpl).then(function (result) {
    assertTrue(!!result.sha);
    assertEqual(JSON.parse(fetchImpl._store.content).schema_name, 'Updated');
  });
});
test('pushSchemaToGitHub rejects with {conflict:true} when the supplied sha no longer matches (409)', function () {
  var fetchImpl = makeFakeGitHubFetch({ initialContent: JSON.stringify({ schema_name: 'Old', tables: [] }), initialSha: 'sha-current' });
  return G.pushSchemaToGitHub(VALID_CONFIG, { schema_name: 'MyEdit', tables: [] }, 'sha-stale', fetchImpl).then(function () { throw new Error('expected rejection'); }, function (err) {
    assertTrue(err.conflict === true);
  });
});
test('pushSchemaToGitHub rejects clearly on 401/403/422', function () {
  var f1 = makeFakeGitHubFetch({}); f1._forceNextStatus(401);
  var f2 = makeFakeGitHubFetch({}); f2._forceNextStatus(403);
  var f3 = makeFakeGitHubFetch({}); f3._forceNextStatus(422);
  return Promise.all([
    G.pushSchemaToGitHub(VALID_CONFIG, {}, null, f1).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'Unauthorized'); }),
    G.pushSchemaToGitHub(VALID_CONFIG, {}, null, f2).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'Forbidden'); }),
    G.pushSchemaToGitHub(VALID_CONFIG, {}, null, f3).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, '422'); })
  ]);
});
test('pushSchemaToGitHub rejects when config is incomplete, without making any network call', function () {
  var fetchImpl = makeFakeGitHubFetch({});
  return G.pushSchemaToGitHub({}, {}, null, fetchImpl).then(function () { throw new Error('expected rejection'); }, function (err) {
    assertIncludes(err.message, 'not fully configured');
    assertEqual(fetchImpl._calls.length, 0);
  });
});
test('pushSchemaToGitHub sends the schema as valid UTF-8-safe base64 in the request body', function () {
  var fetchImpl = makeFakeGitHubFetch({});
  var schemaWithUnicode = { schema_name: 'Tëst Schéma', tables: [] };
  return G.pushSchemaToGitHub(VALID_CONFIG, schemaWithUnicode, null, fetchImpl).then(function () {
    assertEqual(JSON.parse(fetchImpl._store.content).schema_name, 'Tëst Schéma');
  });
});

test('end-to-end: create, then read it back, then update it, then read the update back', function () {
  var fetchImpl = makeFakeGitHubFetch({});
  return G.fetchRemoteSchema(VALID_CONFIG, fetchImpl)
    .then(function (r0) { assertFalse(r0.exists); return G.pushSchemaToGitHub(VALID_CONFIG, { schema_name: 'V1', tables: [] }, null, fetchImpl); })
    .then(function () { return G.fetchRemoteSchema(VALID_CONFIG, fetchImpl); })
    .then(function (r1) { assertTrue(r1.exists); assertEqual(r1.schema.schema_name, 'V1'); return G.pushSchemaToGitHub(VALID_CONFIG, { schema_name: 'V2', tables: [] }, r1.sha, fetchImpl); })
    .then(function () { return G.fetchRemoteSchema(VALID_CONFIG, fetchImpl); })
    .then(function (r2) { assertTrue(r2.exists); assertEqual(r2.schema.schema_name, 'V2'); });
});

test('describeGitHubSyncStatus: not configured yet', function () {
  assertEqual(G.describeGitHubSyncStatus({ configured: false }).level, 'unconfigured');
});
test('describeGitHubSyncStatus: an explicit error takes priority over other states', function () {
  var d = G.describeGitHubSyncStatus({ configured: true, error: 'Could not reach GitHub.' });
  assertEqual(d.level, 'error');
  assertEqual(d.text, 'Could not reach GitHub.');
});
test('describeGitHubSyncStatus: conflict detected', function () {
  assertEqual(G.describeGitHubSyncStatus({ configured: true, conflict: true }).level, 'conflict');
});
test('describeGitHubSyncStatus: connected and healthy mentions owner/repo/path/branch', function () {
  var d = G.describeGitHubSyncStatus({ configured: true, owner: 'acme', repo: 'schema-store', path: 'schema.json', branch: 'main' });
  assertEqual(d.level, 'connected');
  assertIncludes(d.text, 'acme/schema-store');
  assertIncludes(d.text, 'schema.json');
});
test('describeGitHubSyncStatus handles a completely empty state object without throwing', function () {
  assertEqual(G.describeGitHubSyncStatus({}).level, 'unconfigured');
});
