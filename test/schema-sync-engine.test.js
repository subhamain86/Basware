'use strict';
var path = require('path');
var SYNC = require(path.join(__dirname, '..', 'js', 'schema-sync-engine.js'));

function makeFakeIndexedDB() {
  var stores = {};
  return {
    open: function (dbName, version) {
      var req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null, error: null };
      setTimeout(function () {
        var isNew = !stores[dbName];
        if (isNew) stores[dbName] = {};
        var db = {
          createObjectStore: function (storeName) { stores[dbName][storeName] = {}; },
          transaction: function (storeName, mode) {
            var tx = { oncomplete: null, onerror: null, error: null };
            var objectStoreApi = {
              put: function (value, key) {
                var putReq = { onsuccess: null, onerror: null };
                setTimeout(function () { stores[dbName][storeName][key] = value; if (tx.oncomplete) tx.oncomplete(); if (putReq.onsuccess) putReq.onsuccess(); }, 0);
                return putReq;
              },
              get: function (key) {
                var getReq = { result: undefined, onsuccess: null, onerror: null };
                setTimeout(function () { getReq.result = stores[dbName][storeName][key]; if (getReq.onsuccess) getReq.onsuccess(); }, 0);
                return getReq;
              },
              delete: function (key) {
                var delReq = { onsuccess: null, onerror: null };
                setTimeout(function () { delete stores[dbName][storeName][key]; if (tx.oncomplete) tx.oncomplete(); if (delReq.onsuccess) delReq.onsuccess(); }, 0);
                return delReq;
              }
            };
            tx.objectStore = function () { return objectStoreApi; };
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

test('reports supported when both picker functions exist on the window object', function () {
  assertTrue(SYNC.isFileSystemAccessSupported({ showSaveFilePicker: function () {}, showOpenFilePicker: function () {} }));
});
test('reports unsupported when either picker function is missing', function () {
  assertFalse(SYNC.isFileSystemAccessSupported({ showSaveFilePicker: function () {} }));
  assertFalse(SYNC.isFileSystemAccessSupported({}));
  assertFalse(SYNC.isFileSystemAccessSupported(undefined));
});

test('loadHandle returns null when nothing has been saved yet', function () {
  var store = SYNC.createHandleStore(makeFakeIndexedDB());
  return store.loadHandle().then(function (h) { assertEqual(h, null); });
});
test('saveHandle then loadHandle round-trips the exact same handle object', function () {
  var store = SYNC.createHandleStore(makeFakeIndexedDB());
  var fakeHandle = { name: 'schema.json', __marker: 'abc123' };
  return store.saveHandle(fakeHandle).then(function () { return store.loadHandle(); }).then(function (h) {
    assertEqual(h.name, 'schema.json');
    assertEqual(h.__marker, 'abc123');
  });
});
test('clearHandle removes a previously saved handle', function () {
  var store = SYNC.createHandleStore(makeFakeIndexedDB());
  return store.saveHandle({ name: 'x.json' }).then(function () { return store.clearHandle(); }).then(function () { return store.loadHandle(); }).then(function (h) { assertEqual(h, null); });
});
test('createHandleStore rejects cleanly when IndexedDB is entirely unavailable', function () {
  var store = SYNC.createHandleStore(null);
  return store.loadHandle().then(function () { throw new Error('expected loadHandle() to reject'); }, function (err) { assertIncludes(err.message, 'IndexedDB is not available'); });
});

test('verifyPermissionSilent resolves true when already granted, without ever calling requestPermission', function () {
  var requestCalled = false;
  var handle = { queryPermission: function () { return Promise.resolve('granted'); }, requestPermission: function () { requestCalled = true; return Promise.resolve('granted'); } };
  return SYNC.verifyPermissionSilent(handle, 'read').then(function (ok) { assertTrue(ok); assertFalse(requestCalled); });
});
test('verifyPermissionSilent resolves false when not granted, without prompting', function () {
  var requestCalled = false;
  var handle = { queryPermission: function () { return Promise.resolve('prompt'); }, requestPermission: function () { requestCalled = true; return Promise.resolve('granted'); } };
  return SYNC.verifyPermissionSilent(handle).then(function (ok) { assertFalse(ok); assertFalse(requestCalled); });
});
test('verifyPermission resolves true immediately when already granted (no prompt needed)', function () {
  var handle = { queryPermission: function () { return Promise.resolve('granted'); }, requestPermission: function () { throw new Error('should not be called'); } };
  return SYNC.verifyPermission(handle).then(function (ok) { assertTrue(ok); });
});
test('verifyPermission falls through to requestPermission when not already granted, and honors its result', function () {
  var handle = { queryPermission: function () { return Promise.resolve('prompt'); }, requestPermission: function () { return Promise.resolve('granted'); } };
  return SYNC.verifyPermission(handle).then(function (ok) { assertTrue(ok); });
});
test('verifyPermission resolves false when the user denies the request', function () {
  var handle = { queryPermission: function () { return Promise.resolve('prompt'); }, requestPermission: function () { return Promise.resolve('denied'); } };
  return SYNC.verifyPermission(handle).then(function (ok) { assertFalse(ok); });
});

function fakeHandleWithContent(jsonText, lastModified) {
  return {
    getFile: function () { return Promise.resolve({ lastModified: lastModified || 1000, text: function () { return Promise.resolve(jsonText); } }); }
  };
}
test('readSchemaFromHandle parses a valid schema object with a tables array', function () {
  var handle = fakeHandleWithContent(JSON.stringify({ schema_name: 'X', tables: [{ name: 'T', columns: [] }] }), 12345);
  return SYNC.readSchemaFromHandle(handle).then(function (result) {
    assertEqual(result.schema.schema_name, 'X');
    assertEqual(result.lastModified, 12345);
  });
});
test('readSchemaFromHandle accepts a bare array-of-tables shape too', function () {
  var handle = fakeHandleWithContent(JSON.stringify([{ name: 'T', columns: [] }]));
  return SYNC.readSchemaFromHandle(handle).then(function (result) { assertTrue(Array.isArray(result.schema)); });
});
test('readSchemaFromHandle rejects with a clear error on invalid JSON', function () {
  var handle = fakeHandleWithContent('this is not json{{{');
  return SYNC.readSchemaFromHandle(handle).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'valid JSON'); });
});
test('readSchemaFromHandle rejects with a clear error when the JSON has no tables array', function () {
  var handle = fakeHandleWithContent(JSON.stringify({ foo: 'bar' }));
  return SYNC.readSchemaFromHandle(handle).then(function () { throw new Error('expected rejection'); }, function (err) { assertIncludes(err.message, 'valid AP-SQL Assistant schema'); });
});
test('writeSchemaToHandle writes the JSON-stringified schema and closes the writable stream', function () {
  var written = null, closed = false;
  var handle = { createWritable: function () { return Promise.resolve({ write: function (text) { written = text; return Promise.resolve(); }, close: function () { closed = true; return Promise.resolve(); } }); } };
  return SYNC.writeSchemaToHandle(handle, { schema_name: 'Y', tables: [] }).then(function () {
    assertTrue(closed);
    assertEqual(JSON.parse(written).schema_name, 'Y');
  });
});

test('describeSyncStatus: unsupported browser', function () {
  assertEqual(SYNC.describeSyncStatus({ supported: false }).level, 'unsupported');
});
test('describeSyncStatus: an explicit error takes priority over other states', function () {
  var d = SYNC.describeSyncStatus({ supported: true, linked: true, error: 'Could not write to the file.' });
  assertEqual(d.level, 'error');
  assertEqual(d.text, 'Could not write to the file.');
});
test('describeSyncStatus: needs reconnect', function () {
  var d = SYNC.describeSyncStatus({ supported: true, linked: true, needsReconnect: true, fileName: 'shared-schema.json' });
  assertEqual(d.level, 'reconnect');
  assertIncludes(d.text, 'shared-schema.json');
});
test('describeSyncStatus: not linked yet', function () {
  assertEqual(SYNC.describeSyncStatus({ supported: true, linked: false }).level, 'unlinked');
});
test('describeSyncStatus: linked and healthy', function () {
  var d = SYNC.describeSyncStatus({ supported: true, linked: true, fileName: 'team-schema.json' });
  assertEqual(d.level, 'linked');
  assertIncludes(d.text, 'team-schema.json');
});
test('describeSyncStatus handles a completely empty state object without throwing', function () {
  var d = SYNC.describeSyncStatus({});
  assertEqual(d.level, 'unsupported');
});
