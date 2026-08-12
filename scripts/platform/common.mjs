/**
 * Platform abstractions shared by both OSes: data-directory resolution
 * with LOCAL_APP_DATA_DIR override, executable discovery, and the
 * platform identity helpers. Pure functions (env injected) so they are
 * unit-testable without mocking process.
 */
import os from 'node:os';
import path from 'node:path';

export const APP_DATA_SUBDIR = 'com.patrick.shoucang';

/** Windows default data directory: %LOCALAPPDATA%\com.patrick.shoucang */
export function windowsDataDirectory(env = process.env, home = os.homedir()) {
  const override = String(env.LOCAL_APP_DATA_DIR || '').trim();
  if (override) return path.resolve(override);
  const localAppData = String(env.LOCALAPPDATA || '').trim();
  return localAppData
    ? path.join(localAppData, APP_DATA_SUBDIR)
    : path.join(home, '.shoucang');
}

/** macOS default data directory: ~/Library/Application Support/com.patrick.shoucang */
export function macosDataDirectory(env = process.env, home = os.homedir()) {
  const override = String(env.LOCAL_APP_DATA_DIR || '').trim();
  if (override) return path.resolve(override);
  return path.join(home, 'Library', 'Application Support', APP_DATA_SUBDIR);
}

/** Linux/other fallback: ~/.shoucang (legacy migration source). */
export function posixDataDirectory(env = process.env, home = os.homedir()) {
  const override = String(env.LOCAL_APP_DATA_DIR || '').trim();
  if (override) return path.resolve(override);
  return path.join(home, '.shoucang');
}

/** Legacy directory kept as migration source only. */
export function legacyDataDirectory(home = os.homedir()) {
  return path.join(home, '.shoucang');
}

export function isWindows(platform = process.platform) {
  return platform === 'win32';
}

export function isMacos(platform = process.platform) {
  return platform === 'darwin';
}

export function platformName(platform = process.platform) {
  return platform;
}
