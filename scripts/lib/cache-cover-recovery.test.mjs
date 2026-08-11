import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { recoverCachedNoteCovers } from './cache-cover-recovery.mjs';

test('recovers an expired remote cover from the WebKit cache', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'kankan-cover-cache-'));
  const cacheDirectory = path.join(directory, 'cache');
  const resourceDirectory = path.join(cacheDirectory, 'Version 17', 'Records', 'record', 'Resource');
  const mediaDirectory = path.join(directory, 'media');
  const sourceUrl = 'http://sns-webpic-qc.xhscdn.com/spectrum/image-key!nd_dft_wlteh_webp_3';
  const cachedUrl = 'https://sns-webpic-qc.xhscdn.com/new-token/spectrum/image-key!nd_dft_wlteh_jpg_3';
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);

  try {
    await mkdir(resourceDirectory, { recursive: true });
    await writeFile(path.join(resourceDirectory, 'entry'), Buffer.concat([
      Buffer.from([0x11, 0, 0, 0]),
      Buffer.from(cachedUrl, 'utf16le'),
      Buffer.from([0xff, 0xff]),
    ]));
    await writeFile(path.join(resourceDirectory, 'entry-blob'), jpeg);

    const result = await recoverCachedNoteCovers([{
      id: '64cb12340000000001020304',
      coverUrl: sourceUrl,
      imageUrls: [sourceUrl],
    }], {
      cacheDirectories: [cacheDirectory],
      mediaDirectory,
      publicBaseUrl: 'http://127.0.0.1:4318',
    });

    assert.equal(result.recoveredCount, 1);
    assert.equal(result.notes[0].coverUrl, 'http://127.0.0.1:4318/media/64cb12340000000001020304/00.jpg');
    assert.deepEqual(result.notes[0].imageUrls, [result.notes[0].coverUrl]);
    assert.deepEqual(
      await readFile(path.join(mediaDirectory, '64cb12340000000001020304', '00.jpg')),
      jpeg,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('leaves a note unchanged when no matching cache entry exists', async () => {
  const note = {
    id: '64cb12340000000001020304',
    coverUrl: 'https://sns-webpic-qc.xhscdn.com/missing.jpg',
    imageUrls: [],
  };
  const result = await recoverCachedNoteCovers([note], {
    cacheDirectories: [],
    mediaDirectory: '/tmp/unused-kankan-media',
    publicBaseUrl: 'http://127.0.0.1:4318',
  });

  assert.equal(result.recoveredCount, 0);
  assert.equal(result.notes[0], note);
});
