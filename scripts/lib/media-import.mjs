import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;
const MEDIA_HOST_SUFFIXES = ['.xhscdn.com', '.xhsimg.com'];
const CONTENT_TYPE_EXTENSIONS = new Map([
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOcrScriptPath = path.resolve(moduleDirectory, '..', 'macos-vision-ocr.js');

export function isAllowedRemoteImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && MEDIA_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_EXTENSIONS.get(normalized) || '';
}

async function fetchImageResponse(url, fetchImpl, redirectCount = 0) {
  if (!isAllowedRemoteImageUrl(url)) throw new Error('图片地址不属于受支持的小红书图床');

  const response = await fetchImpl(url, {
    redirect: 'manual',
    credentials: 'omit',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://www.xiaohongshu.com/',
      'User-Agent': 'KanKanFavorites/0.1 local-media-import',
    },
  });

  if (response.status >= 300 && response.status < 400) {
    if (redirectCount >= MAX_REDIRECTS) throw new Error('图片重定向次数过多');
    const location = response.headers.get('location');
    if (!location) throw new Error('图片重定向缺少目标地址');
    return fetchImageResponse(new URL(location, url).toString(), fetchImpl, redirectCount + 1);
  }
  if (!response.ok) throw new Error(`图片下载失败：${response.status}`);
  return response;
}

async function downloadImage(url, noteDirectory, index, fetchImpl) {
  const response = await fetchImageResponse(url, fetchImpl);
  const extension = extensionFromContentType(response.headers.get('content-type'));
  if (!extension) throw new Error('远程内容不是可识别的图片');

  const declaredLength = Number.parseInt(response.headers.get('content-length') || '0', 10);
  if (declaredLength > MAX_IMAGE_BYTES) throw new Error('单张图片超过 15MB');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('单张图片超过 15MB');

  const fileName = `${String(index + 1).padStart(2, '0')}${extension}`;
  const filePath = path.join(noteDirectory, fileName);
  await writeFile(filePath, buffer);
  return { fileName, filePath, sourceUrl: url };
}

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

async function mapWithConcurrency(values, concurrency, callback) {
  const results = new Array(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await callback(values[index], index);
      } catch (error) {
        results[index] = {
          error: error instanceof Error ? error.message : '图片处理失败',
          sourceUrl: values[index],
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

export async function localizeNoteMedia(note, options) {
  const sourceUrls = Array.from(new Set(
    (note.imageUrls || []).filter(isAllowedRemoteImageUrl),
  )).slice(0, 20);
  if (sourceUrls.length === 0) {
    return {
      ...note,
      sourceImageUrls: [],
      imageUrls: [],
      imageOcr: [],
      ocrText: '',
      mediaStatus: 'none',
    };
  }

  const noteDirectory = path.join(options.mediaDirectory, note.id);
  await mkdir(noteDirectory, { recursive: true });
  const downloads = await mapWithConcurrency(
    sourceUrls,
    options.downloadConcurrency || 2,
    (url, index) => downloadImage(url, noteDirectory, index, options.fetchImpl || fetch),
  );
  const successful = downloads.filter((item) => item?.filePath);

  let ocrResults = [];
  let ocrError = '';
  try {
    ocrResults = await (options.ocrRunner || runMacVisionOcr)(
      successful.map((item) => item.filePath),
    );
  } catch (error) {
    ocrError = error instanceof Error ? error.message : '本地 OCR 失败';
  }
  const ocrByPath = new Map(ocrResults.map((result) => [result.path, result]));
  const imageOcr = successful.map((item) => {
    const result = ocrByPath.get(item.filePath);
    return {
      imageUrl: `${options.publicBaseUrl}/media/${note.id}/${item.fileName}`,
      text: typeof result?.text === 'string' ? result.text.trim() : '',
      error: result?.error || '',
    };
  });
  const localImageUrls = imageOcr.map((item) => item.imageUrl);
  const ocrText = imageOcr.map((item) => item.text).filter(Boolean).join('\n\n');
  const failedDownloads = downloads.length - successful.length;

  return {
    ...note,
    sourceImageUrls: sourceUrls,
    imageUrls: localImageUrls,
    coverUrl: localImageUrls[0] || note.coverUrl || '',
    imageOcr,
    ocrText,
    mediaStatus: failedDownloads === 0 && !ocrError ? 'ready' : 'partial',
    mediaError: [
      failedDownloads ? `${failedDownloads} 张图片保存失败` : '',
      ocrError,
    ].filter(Boolean).join('；'),
  };
}
