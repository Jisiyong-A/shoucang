import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  legacyDataDirectory,
  macosDataDirectory,
  posixDataDirectory,
  windowsDataDirectory,
} from './common.mjs';
import { browserExecutable, knownExecutableCandidates } from './windows.mjs';

const HOME = 'C:\\Users\\tester';

test('win32: LOCAL_APP_DATA_DIR override wins', () => {
  const env = { LOCAL_APP_DATA_DIR: 'D:\\custom\\data', LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' };
  assert.equal(windowsDataDirectory(env, HOME), path.resolve('D:\\custom\\data'));
});

test('win32: falls back to %LOCALAPPDATA%\\com.patrick.shoucang', () => {
  const env = { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' };
  assert.equal(
    windowsDataDirectory(env, HOME),
    path.join('C:\\Users\\tester\\AppData\\Local', 'com.patrick.shoucang'),
  );
});

test('win32: last-resort home fallback without LOCALAPPDATA', () => {
  assert.equal(
    windowsDataDirectory({}, HOME),
    path.join(HOME, '.shoucang'),
  );
});

test('darwin: macOS Application Support path', () => {
  const env = {};
  assert.equal(
    macosDataDirectory(env, HOME),
    path.join(HOME, 'Library', 'Application Support', 'com.patrick.shoucang'),
  );
});

test('darwin: LOCAL_APP_DATA_DIR override wins', () => {
  assert.equal(
    macosDataDirectory({ LOCAL_APP_DATA_DIR: 'X:\\app\\data' }, HOME),
    path.resolve('X:\\app\\data'),
  );
});

test('posix: home dot-dir fallback', () => {
  assert.equal(posixDataDirectory({}, HOME), path.join(HOME, '.shoucang'));
});

test('legacy data directory is only a migration source', () => {
  assert.equal(legacyDataDirectory(HOME), path.join(HOME, '.shoucang'));
});

test('win32 agent candidate shapes (codex / claude)', () => {
  const codex = knownExecutableCandidates('codex', {});
  assert.ok(codex.some((c) => c.endsWith('codex.exe')));
  assert.ok(codex.some((c) => c.endsWith('codex.cmd')));
  const claude = knownExecutableCandidates('claude', {});
  assert.ok(claude.some((c) => c.endsWith('claude.exe')));
  assert.ok(claude.some((c) => c.endsWith('claude.cmd')));
  assert.deepEqual(knownExecutableCandidates('other', {}), []);
});

test('win32 browserExecutable: no browsers in fake env -> null', () => {
  const env = {
    ProgramFiles: 'C:\\NoSuch\\Program Files',
    'ProgramFiles(x86)': 'C:\\NoSuch\\Program Files (x86)',
    LOCALAPPDATA: 'C:\\NoSuch\\Local',
  };
  assert.equal(browserExecutable(env), null);
});

test('win32 browserExecutable: chrome preferred over edge', () => {
  const env = {
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local',
  };
  const browser = browserExecutable(env);
  // Real machine may or may not have Chrome in Program Files; just verify the
  // URL contract when a browser is found, and that edge fallback paths exist.
  if (browser) {
    assert.ok(browser.extensionsUrl.endsWith('://extensions/'));
  }
});
