/**
 * macOS OCR adapter — Vision framework via JXA/osascript bridge.
 * Kept for the original macOS build path.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOcrScriptPath = path.resolve(moduleDirectory, '..', 'macos-vision-ocr.js');

export const ENGINE_NAME = 'vision';

/** @param {string[]} imagePaths @param {object} [options] */
export async function runMacVisionOcr(imagePaths, options = {}) {
  if (process.platform !== 'darwin' || imagePaths.length === 0) return [];
  const scriptPath = options.ocrScriptPath || defaultOcrScriptPath;
  const { stdout } = await execFileAsync('/usr/bin/osascript', [
    '-l',
    'JavaScript',
    scriptPath,
    ...imagePaths,
  ], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000,
  });
  const payload = JSON.parse(stdout);
  return Array.isArray(payload) ? payload : [];
}
