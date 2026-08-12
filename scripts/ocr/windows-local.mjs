/**
 * Windows OCR adapter — Windows.Media.Ocr (WinRT) via PowerShell bridge.
 * Zero bundled dependencies: engine ships with Windows 10 1809+/11,
 * recognizer languages follow installed language packs (zh-Hans-CN,
 * en-GB, zh-Hant-TW, ...). Fully local, no cloud, no Python.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { parseWindowsOcrOutput } from './normalize.mjs';

const execFileAsync = promisify(execFile);
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOcrScriptPath = path.resolve(moduleDirectory, '..', 'windows-ocr.ps1');

export const ENGINE_NAME = 'windows';

let cachedPowerShell = null;

/**
 * Windows 11 may lack the System32\powershell.exe shim; the real binary
 * lives in WindowsPowerShell\v1.0. Prefer PATH resolution, fall back to
 * the absolute well-known path so a minimal PATH cannot break OCR.
 */
function resolvePowerShellExecutable() {
  if (cachedPowerShell) return cachedPowerShell;
  const candidates = [
    path.join(process.env.SystemRoot || 'C:\\\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    'powershell.exe',
  ];
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) && !existsSync(candidate)) continue;
    cachedPowerShell = candidate;
    return candidate;
  }
  cachedPowerShell = candidates[0];
  return cachedPowerShell;
}

/**
 * @param {string[]} imagePaths
 * @param {object} [options] { ocrScriptPath?, timeoutMs? }
 * @returns {Promise<Array<{path, text, error}>>} same shape as runMacVisionOcr
 */
export async function runWindowsOcr(imagePaths, options = {}) {
  if (process.platform !== 'win32' || imagePaths.length === 0) return [];
  // WinRT StorageFile.GetFileFromPathAsync requires native backslash paths.
  const nativePaths = imagePaths.map((p) => path.resolve(p).replace(/\//g, '\\'));
  const scriptPath = options.ocrScriptPath || defaultOcrScriptPath;
  try {
    const { stdout } = await execFileAsync(resolvePowerShellExecutable(), [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-ImagePaths',
      ...nativePaths,
    ], {
      maxBuffer: 16 * 1024 * 1024,
      timeout: options.timeoutMs || 300_000,
      encoding: 'utf8',
      windowsHide: true,
    });
    return parseWindowsOcrOutput(stdout);
  } catch {
    return [];
  }
}

/** Probe whether a recognizer language is available (one-time startup use). */
export async function probeWindowsOcr(scriptPath = defaultOcrScriptPath) {
  if (process.platform !== 'win32') {
    return { available: false, languages: [], error: 'not windows' };
  }
  try {
    const { stdout } = await execFileAsync(resolvePowerShellExecutable(), [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-ProbeOnly',
    ], {
      maxBuffer: 1024 * 1024,
      timeout: 60_000,
      encoding: 'utf8',
      windowsHide: true,
    });
    const start = stdout.indexOf('{');
    if (start < 0) return { available: false, languages: [], error: 'bad probe output' };
    const payload = JSON.parse(stdout.slice(start));
    return {
      available: Boolean(payload?.available),
      languages: Array.isArray(payload?.languages) ? payload.languages : [],
      error: payload?.error || null,
    };
  } catch (error) {
    return {
      available: false,
      languages: [],
      error: error instanceof Error ? error.message : 'probe failed',
    };
  }
}
