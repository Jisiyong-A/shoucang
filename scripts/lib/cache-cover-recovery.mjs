import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const UTF16_HTTP_PREFIX = Buffer.from('http', 'utf16le');

function extractCachedUrl(buffer) {
  const start = buffer.indexOf(UTF16_HTTP_PREFIX);
  if (start < 0) return '';

  let value = '';
  for (let offset = start; offset + 1 < buffer.length; offset += 2) {
    const character = buffer[offset];
    if (buffer[offset + 1] !== 0 || character < 32 || character > 126) break;
    value += String.fromCharCode(character);
  }
  return value;
}

function stableImageKey(value) {
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith('.xhscdn.com') && !url.hostname.endsWith('.xhsimg.com')) return '';
    return decodeURIComponent(url.pathname.split('/').pop() || '').split('!')[0];
  } catch {
    return '';
  }
}

function imageExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return '.gif';
  return '';
}

async function buildCacheIndex(cacheDirectories) {
  const index = new Map();

  for (const cacheDirectory of cacheDirectories) {
    const recordsDirectory = path.join(cacheDirectory, 'Version 17', 'Records');
    if (!existsSync(recordsDirectory)) continue;

    for (const recordName of await readdir(recordsDirectory)) {
      const resourceDirectory = path.join(recordsDirectory, recordName, 'Resource');
      if (!existsSync(resourceDirectory)) continue;

      for (const fileName of await readdir(resourceDirectory)) {
        if (fileName.endsWith('-blob')) continue;
        const blobPath = path.join(resourceDirectory, `${fileName}-blob`);
        if (!existsSync(blobPath)) continue;

        const metadata = await readFile(path.join(resourceDirectory, fileName));
        const key = stableImageKey(extractCachedUrl(metadata));
        if (key && !index.has(key)) index.set(key, blobPath);
      }
    }
  }

  return index;
}

function isLocalMediaUrl(value, publicBaseUrl) {
  return typeof value === 'string' && value.startsWith(`${publicBaseUrl}/media/`);
}

export async function recoverCachedNoteCovers(notes, options) {
  if (!Array.isArray(notes) || notes.length === 0 || process.platform !== 'darwin') {
    return { notes, recoveredCount: 0 };
  }

  const cacheIndex = await buildCacheIndex(options.cacheDirectories || []);
  let recoveredCount = 0;
  const recoveredNotes = [];

  for (const note of notes) {
    if (!note?.id || isLocalMediaUrl(note.coverUrl, options.publicBaseUrl)) {
      recoveredNotes.push(note);
      continue;
    }

    const coverKey = stableImageKey(note.coverUrl);
    const cachedBlobPath = cacheIndex.get(coverKey);
    if (!coverKey || !cachedBlobPath) {
      recoveredNotes.push(note);
      continue;
    }

    const cachedImage = await readFile(cachedBlobPath);
    const extension = imageExtension(cachedImage);
    if (!extension) {
      recoveredNotes.push(note);
      continue;
    }

    const noteDirectory = path.join(options.mediaDirectory, note.id);
    const destinationPath = path.join(noteDirectory, `00${extension}`);
    await mkdir(noteDirectory, { recursive: true });
    if (!existsSync(destinationPath)) await copyFile(cachedBlobPath, destinationPath);

    const localCoverUrl = `${options.publicBaseUrl}/media/${note.id}/00${extension}`;
    const currentImageUrls = Array.isArray(note.imageUrls) ? note.imageUrls : [];
    let replacedCover = false;
    const imageUrls = currentImageUrls.map((imageUrl) => {
      if (stableImageKey(imageUrl) !== coverKey) return imageUrl;
      replacedCover = true;
      return localCoverUrl;
    });
    if (!replacedCover) imageUrls.unshift(localCoverUrl);

    recoveredNotes.push({
      ...note,
      coverUrl: localCoverUrl,
      imageUrls,
      sourceImageUrls: Array.isArray(note.sourceImageUrls) && note.sourceImageUrls.length > 0
        ? note.sourceImageUrls
        : currentImageUrls,
    });
    recoveredCount += 1;
  }

  return { notes: recoveredNotes, recoveredCount };
}
