/**
 * Windows platform adapter.
 * - data directory: %LOCALAPPDATA%\com.patrick.kankanshoucang (LOCAL_APP_DATA_DIR wins)
 * - executable discovery: known install paths, then `where`
 * - open folder: explorer.exe
 * - open browser URL: Chrome (Program Files / x86 / LOCALAPPDATA), else Edge
 */
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { windowsDataDirectory } from './common.mjs';

const execFileAsync = promisify(execFile);

export function dataDirectory(env = process.env) {
  return windowsDataDirectory(env);
}

export function knownExecutableCandidates(client) {
  const home = os.homedir();
  if (client === 'codex') {
    return [
      path.join(home, '.local', 'bin', 'codex.exe'),
      path.join(home, 'AppData', 'Roaming', 'npm', 'codex.cmd'),
    ];
  }
  if (client === 'claude') {
    return [
      path.join(home, '.local', 'bin', 'claude.exe'),
      path.join(home, '.claude', 'local', 'claude.exe'),
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    ];
  }
  return [];
}

export async function resolveExecutable(name, env = process.env) {
  const known = knownExecutableCandidates(name, env).find((candidate) => existsSync(candidate));
  if (known) return known;

  try {
    const { stdout } = await execFileAsync('where', [name], {
      timeout: 5000,
      maxBuffer: 64 * 1024,
    });
    return stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line && existsSync(line)) || null;
  } catch {
    return null;
  }
}

export function openFolder(folderPath) {
  const child = spawn('explorer.exe', [folderPath], { detached: true, stdio: 'ignore' });
  child.unref();
}

export function browserExecutable(env = process.env) {
  const programFiles = String(env.ProgramFiles || 'C:\\Program Files');
  const programFilesX86 = String(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)');
  const localAppData = String(env.LOCALAPPDATA || '');
  const chromeCandidates = [
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
  ].filter(Boolean);
  const chrome = chromeCandidates.find((candidate) => existsSync(candidate));
  if (chrome) return { executable: chrome, extensionsUrl: 'chrome://extensions/' };

  const edgeCandidates = [
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);
  const edge = edgeCandidates.find((candidate) => existsSync(candidate));
  if (edge) return { executable: edge, extensionsUrl: 'edge://extensions/' };
  return null;
}

export function openBrowserUrl(url, env = process.env) {
  const browser = browserExecutable(env);
  if (!browser) return false;
  const child = spawn(browser.executable, [url], { detached: true, stdio: 'ignore' });
  child.unref();
  return true;
}
