/**
 * OCR facade — business code never touches engine specifics.
 *
 *   import { runOcr, probeLocalOcr, getOcrEngineInfo } from './ocr/index.mjs';
 *   const results = await runOcr(imagePaths, { concurrency: 1 });
 *
 * Pipeline: media-import → ocr/index → platform adapter → engine.
 */
import { OCR_ENGINE_VERSION } from './types.mjs';
import { runMacVisionOcr, ENGINE_NAME as VISION_ENGINE } from './macos-vision.mjs';
import { runWindowsOcr, probeWindowsOcr, ENGINE_NAME as WINDOWS_ENGINE } from './windows-local.mjs';

/**
 * Unified entry — returns per-image results plus engine metadata.
 * @param {string[]} imagePaths
 * @param {object} [options] { engine?: 'auto'|'windows'|'vision', concurrency? }
 * @returns {Promise<{results: Array<{path,text,confidence?,error}>, engine, engineVersion}>}
 */
export async function runOcr(imagePaths, options = {}) {
  const engine = options.engine || 'auto';
  let results = [];
  let engineName = null;

  if (engine === 'auto') {
    if (process.platform === 'darwin') {
      results = await runMacVisionOcr(imagePaths, options);
      engineName = VISION_ENGINE;
    } else if (process.platform === 'win32') {
      results = await runWindowsOcr(imagePaths, options);
      engineName = WINDOWS_ENGINE;
    }
  } else if (engine === 'windows') {
    results = await runWindowsOcr(imagePaths, options);
    engineName = WINDOWS_ENGINE;
  } else if (engine === 'vision') {
    results = await runMacVisionOcr(imagePaths, options);
    engineName = VISION_ENGINE;
  }

  return {
    results,
    engine: engineName,
    engineVersion: engineName ? OCR_ENGINE_VERSION : null,
  };
}

/** Engine availability probe (startup /health). */
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

/** Current engine identity for persisted metadata. */
export function getOcrEngineInfo(engineName) {
  return {
    engine: engineName || null,
    engineVersion: engineName ? OCR_ENGINE_VERSION : null,
  };
}
