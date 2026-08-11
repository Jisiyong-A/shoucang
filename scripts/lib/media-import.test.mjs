import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isAllowedRemoteImageUrl, localizeNoteMedia } from './media-import.mjs';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('image URL allowlist accepts Xiaohongshu CDN only', () => {
  assert.equal(isAllowedRemoteImageUrl('https://sns-webpic-qc.xhscdn.com/a.webp'), true);
  assert.equal(isAllowedRemoteImageUrl('https://images.xhsimg.com/a.jpg'), true);
  assert.equal(isAllowedRemoteImageUrl('https://example.com/a.jpg'), false);
  assert.equal(isAllowedRemoteImageUrl('http://sns-webpic-qc.xhscdn.com/a.webp'), false);
});

test('localizeNoteMedia saves images and combines local OCR text', async () => {
  const mediaDirectory = await mkdtemp(path.join(os.tmpdir(), 'kankan-media-test-'));
  const sourceUrl = 'https://sns-webpic-qc.xhscdn.com/a.png';
  let downloadInit;

  try {
    const note = await localizeNoteMedia({
      id: '64cb12340000000001020304',
      imageUrls: [sourceUrl],
      coverUrl: sourceUrl,
    }, {
      mediaDirectory,
      publicBaseUrl: 'http://127.0.0.1:4318',
      fetchImpl: async (_url, init) => {
        downloadInit = init;
        return new Response(tinyPng, {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        });
      },
      ocrRunner: async (paths) => paths.map((imagePath) => ({
        path: imagePath,
        text: '图片里的中文',
      })),
    });

    assert.equal(note.mediaStatus, 'ready');
    assert.equal(note.ocrText, '图片里的中文');
    assert.deepEqual(note.sourceImageUrls, [sourceUrl]);
    assert.deepEqual(note.imageUrls, [
      'http://127.0.0.1:4318/media/64cb12340000000001020304/01.png',
    ]);
    assert.equal(downloadInit.credentials, 'omit');
    assert.doesNotThrow(() => new Headers(downloadInit.headers));
    assert.equal(
      Object.keys(downloadInit.headers).some((name) => name.toLowerCase() === 'cookie'),
      false,
    );
    const stored = await readFile(path.join(
      mediaDirectory,
      '64cb12340000000001020304',
      '01.png',
    ));
    assert.deepEqual(stored, tinyPng);
  } finally {
    await rm(mediaDirectory, { recursive: true, force: true });
  }
});
