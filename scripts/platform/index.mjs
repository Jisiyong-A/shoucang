/**
 * Unified platform facade. Import this from business code instead of
 * scattering `if (process.platform === ...)` branches.
 *
 *   import * as platform from './platform/index.mjs';
 *   platform.dataDirectory();
 *   await platform.resolveAgentExecutable('claude');
 *   platform.openFolder(dir);
 *   platform.openBrowserUrl(url);
 *   platform.platformName();
 */
import * as common from './common.mjs';
import * as windows from './windows.mjs';
import * as macos from './macos.mjs';

const adapter = common.isWindows() ? windows : (common.isMacos() ? macos : null);

function unsupported() {
  throw new Error(`Platform not supported: ${process.platform}`);
}

export function dataDirectory(env = process.env) {
  return adapter ? adapter.dataDirectory(env) : common.posixDataDirectory(env);
}

export async function resolveAgentExecutable(client, env = process.env) {
  if (!adapter) return null;
  return adapter.resolveExecutable(client, env);
}

export function openFolder(folderPath) {
  if (!adapter) return unsupported();
  return adapter.openFolder(folderPath);
}

export function openBrowserUrl(url, browser = 'auto') {
  if (!adapter) return unsupported();
  return adapter.openBrowserUrl(url, process.env, browser);
}

/** Which Chromium browsers are installed (windows adapter only). */
export function detectBrowsers() {
  if (!adapter) return { chrome: false, edge: false };
  return typeof adapter.detectBrowsers === 'function'
    ? adapter.detectBrowsers()
    : { chrome: false, edge: false };
}

export { isWindows, isMacos, platformName, legacyDataDirectory } from './common.mjs';

/** The adapter module itself (for tests / advanced use). */
export function currentAdapter() {
  return adapter;
}
