'use strict';
var fs = require('fs');
var path = require('path');
var total = 0, passed = 0, failedList = [];
global.test = function (name, fn) {
  total++;
  try { fn(); passed++; console.log('  \u2713 ' + name); }
  catch (e) { failedList.push({ name: name, error: e }); console.log('  \u2717 ' + name); console.log('      ' + (e && e.message ? e.message : e)); }
};
global.assertEqual = function (actual, expected, msg) { var a = JSON.stringify(actual), e = JSON.stringify(expected); if (a !== e) throw new Error((msg ? msg + ' — ' : '') + 'expected ' + e + ' but got ' + a); };
global.assertTrue = function (value, msg) { if (!value) throw new Error(msg || 'expected truthy value'); };
global.assertFalse = function (value, msg) { if (value) throw new Error(msg || 'expected falsy value'); };
global.assertIncludes = function (haystack, needle, msg) { if (String(haystack).indexOf(needle) === -1) throw new Error((msg ? msg + ' — ' : '') + 'expected to find "' + needle + '" in: ' + haystack); };
global.assertThrows = function (fn, msg) { var threw = false; try { fn(); } catch (e) { threw = true; } if (!threw) throw new Error(msg || 'expected function to throw'); };
var files = fs.readdirSync(__dirname).filter(function (f) { return f.endsWith('.test.js'); }).sort();
files.forEach(function (f) { console.log('\n' + f); require(path.join(__dirname, f)); });
console.log('\n' + '='.repeat(60));
console.log(passed + '/' + total + ' tests passing');
if (failedList.length) { console.log(failedList.length + ' FAILING TEST(S):'); failedList.forEach(function (f) { console.log('  - ' + f.name); }); process.exitCode = 1; }
else console.log('All tests passed.');
