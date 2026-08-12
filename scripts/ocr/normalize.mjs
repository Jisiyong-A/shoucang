/**
 * Text/output normalization shared by OCR engines.
 */

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

/**
 * Parse the Windows OCR script stdout into a results array. Tolerates
 * stray leading lines (progress/warnings) by scanning for the first
 * JSON structural character.
 */
export function parseWindowsOcrOutput(rawStdout) {
  if (typeof rawStdout !== 'string') return [];
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
