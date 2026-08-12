import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { localizeNoteMedia } from './media-import.mjs';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('localizeNoteMedia persists OCR engine metadata from the facade shape', async () => {
  const mediaDirectory = await mkdtemp(path.join(os.tmpdir(), 'shoucang-media-meta-test-'));
  const sourceUrl = 'https://sns-webpic-qc.xhscdn.com/a.png';

  try {
    const note = await localizeNoteMedia({
      id: '64cb12340000000001020309',
      imageUrls: [sourceUrl],
      coverUrl: sourceUrl,
    }, {
      mediaDirectory,
      publicBaseUrl: 'http://127.0.0.1:4318',
      fetchImpl: async () => new Response(tinyPng, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
      ocrRunner: async (paths) => ({
        results: paths.map((p) => ({ path: p, text: '识别文本' })),
        engine: 'windows',
        engineVersion: '1.0.0',
      }),
    });

    assert.equal(note.mediaStatus, 'ready');
    assert.equal(note.ocrText, '识别文本');
    assert.equal(note.ocrEngine, 'windows');
    assert.equal(note.ocrEngineVersion, '1.0.0');
    assert.ok(note.ocrProcessedAt);
    assert.ok(new Date(note.ocrProcessedAt).getTime() > 0);
  } finally {
    await rm(mediaDirectory, { recursive: true, force: true });
  }
});

test('localizeNoteMedia skips metadata for legacy array-shaped runners', async () => {
  const mediaDirectory = await mkdtemp(path.join(os.tmpdir(), 'shoucang-media-meta-test-'));
  const sourceUrl = 'https://sns-webpic-qc.xhscdn.com/a.png';

  try {
    const note = await localizeNoteMedia({
      id: '64cb1234000000000102030a',
      imageUrls: [sourceUrl],
      coverUrl: sourceUrl,
    }, {
      mediaDirectory,
      publicBaseUrl: 'http://127.0.0.1:4318',
      fetchImpl: async () => new Response(tinyPng, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
      ocrRunner: async (paths) => paths.map((p) => ({ path: p, text: 'x' })),
    });

    assert.equal(note.mediaStatus, 'ready');
    assert.equal(note.ocrEngine, undefined);
  } finally {
    await rm(mediaDirectory, { recursive: true, force: true });
  }
});
