/**
 * OCR result shape shared by every engine adapter.
 *
 * @typedef {Object} OcrResult
 * @property {string} path   absolute path of the recognized image
 * @property {string} text   recognized text ('' when failed/empty)
 * @property {number} [confidence] engine confidence when available
 * @property {string} [error] per-image error message ('' when ok)
 */

/**
 * Engine metadata — persisted alongside results so version bumps can
 * trigger re-recognition.
 *
 * @typedef {Object} OcrEngineInfo
 * @property {string} engine        'windows' | 'vision' | 'rapidocr' | null
 * @property {string} engineVersion adapter version string
 */

export const OCR_ENGINE_VERSION = '1.0.0';
