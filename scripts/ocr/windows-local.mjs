/**
 * Windows OCR adapter — Windows.Media.Ocr (WinRT) via PowerShell bridge.
 * Zero bundled dependencies: engine ships with Windows 10 1809+/11,
 * recognizer languages follow installed language packs (zh-Hans-CN,
 * en-GB, zh-Hant-TW, ...). Fully local, no cloud, no Python.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { parseWindowsOcrOutput } from './normalize.mjs';

const execFileAsync = promisify(execFile);
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOcrScriptPath = path.resolve(moduleDirectory, '..', 'windows-ocr.ps1');

export const ENGINE_NAME = 'windows';

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
    const { stdout } = await execFileAsync('powershell.exe', [
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
    const { stdout } = await execFileAsync('powershell.exe', [
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
