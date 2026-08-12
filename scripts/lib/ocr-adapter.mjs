import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOcrScriptPath = path.resolve(moduleDirectory, '..', 'macos-vision-ocr.js');
const defaultWindowsOcrScriptPath = path.resolve(moduleDirectory, '..', 'windows-ocr.ps1');

/** macOS local OCR via the Vision framework (JXA/osascript bridge). */
export async function runMacVisionOcr(imagePaths, ocrScriptPath = defaultOcrScriptPath) {
  if (process.platform !== 'darwin' || imagePaths.length === 0) return [];
  const { stdout } = await execFileAsync('/usr/bin/osascript', [
    '-l',
    'JavaScript',
    ocrScriptPath,
    ...imagePaths,
  ], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000,
  });
  const payload = JSON.parse(stdout);
  return Array.isArray(payload) ? payload : [];
}

/**
 * Windows.Media.Ocr inserts spaces between CJK glyphs ("手 冲 咖 啡").
 * Remove whitespace between CJK characters/punctuation so the text
 * matches natural queries ("咖啡") — latin words keep their spaces.
 */
export function normalizeWindowsOcrText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/([\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF])\s+(?=[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF])/g, '$1')
    .trim();
}

/** Parse the Windows OCR script stdout into a results array. */
export function parseWindowsOcrOutput(rawStdout) {
  if (typeof rawStdout !== 'string') return [];
  // The PowerShell script emits a single JSON document (array or object);
  // tolerate stray leading lines (progress/warnings) by scanning for the
  // first JSON structural character.
  const start = rawStdout.search(/[[{]/);
  if (start < 0) return [];
  try {
    const payload = JSON.parse(rawStdout.slice(start));
    if (Array.isArray(payload)) {
      return payload.map((entry) => ({
        path: typeof entry?.path === 'string' ? entry.path : '',
        text: normalizeWindowsOcrText(entry?.text),
        error: typeof entry?.error === 'string' ? entry.error : '',
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Windows local OCR via Windows.Media.Ocr (WinRT) through PowerShell.
 * Returns [{ path, text, error }] — same shape as runMacVisionOcr.
 * On any failure returns [] so callers degrade gracefully.
 */
export async function runWindowsOcr(imagePaths, ocrScriptPath = defaultWindowsOcrScriptPath) {
  if (process.platform !== 'win32' || imagePaths.length === 0) return [];
  // WinRT StorageFile.GetFileFromPathAsync requires native backslash paths.
  const nativePaths = imagePaths.map((p) => path.resolve(p).replace(/\//g, '\\'));
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      ocrScriptPath,
      '-ImagePaths',
      ...nativePaths,
    ], {
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300_000,
      encoding: 'utf8',
      windowsHide: true,
    });
    return parseWindowsOcrOutput(stdout);
  } catch {
    return [];
  }
}

/** Probe whether a recognizer language is available (one-time startup use). */
export async function probeWindowsOcr(ocrScriptPath = defaultWindowsOcrScriptPath) {
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
      ocrScriptPath,
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

/** Platform dispatch — the single OCR entry used by the import pipeline. */
export async function runLocalOcr(imagePaths) {
  if (process.platform === 'darwin') return runMacVisionOcr(imagePaths);
  if (process.platform === 'win32') return runWindowsOcr(imagePaths);
  return [];
}

/** Platform dispatch for engine availability probes (startup /health). */
export async function probeLocalOcr() {
  if (process.platform === 'darwin') {
    return { engine: 'vision', available: true, languages: [], error: null };
  }
  if (process.platform === 'win32') {
    const probe = await probeWindowsOcr();
    return {
      engine: 'windows',
      available: probe.available,
      languages: probe.languages,
      error: probe.error,
    };
  }
  return { engine: null, available: false, languages: [], error: 'unsupported platform' };
}
