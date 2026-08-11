import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractNoteIdFromUrl,
  extractSharedNoteUrl,
  mergeImportedNote,
  normalizeImportedNote,
  noteFromSharedText,
  parseDraggedCardInput,
  parseDraggedNoteInput,
  removeStoredNote,
  serializeDraggedNote,
} from './note-import.mjs';

const sourceUrl = 'https://www.xiaohongshu.com/explore/64cb12340000000001020304?xsec_token=abc';

test('extractSharedNoteUrl finds a note URL inside copied text', () => {
  assert.equal(extractSharedNoteUrl(`这条不错 ${sourceUrl} 复制后打开`), sourceUrl);
});

test('extractNoteIdFromUrl supports current and legacy note paths', () => {
  assert.equal(extractNoteIdFromUrl(sourceUrl), '64cb12340000000001020304');
  assert.equal(
    extractNoteIdFromUrl('https://www.xiaohongshu.com/search_result/64cb12340000000001020304?xsec_token=abc'),
    '64cb12340000000001020304'
  );
  assert.equal(
    extractNoteIdFromUrl('https://www.xiaohongshu.com/discovery/item/601a87f50000000001000a07'),
    '601a87f50000000001000a07'
  );
});

test('drag payload round-trips without network access', () => {
  const payload = { sourceUrl, title: '标题', content: '正文内容' };
  assert.deepEqual(parseDraggedNoteInput(serializeDraggedNote(payload)), payload);
});

test('card drag payload preserves the anonymous resolver token', () => {
  const payload = `KANKAN_CARD:${JSON.stringify({
    id: '64cb12340000000001020304',
    sourceUrl,
    title: '卡片标题',
  })}`;
  assert.deepEqual(parseDraggedCardInput(payload), {
    id: '64cb12340000000001020304',
    sourceUrl,
    title: '卡片标题',
  });
});

test('normalizeImportedNote keeps visible page data only', () => {
  const note = normalizeImportedNote({
    sourceUrl,
    title: '标题',
    content: '正文内容',
    author: { name: '作者' },
    imageUrls: ['https://sns-webpic-qc.xhscdn.com/a.jpg'],
  });

  assert.equal(note.id, '64cb12340000000001020304');
  assert.equal(note.sourceUrl, 'https://www.xiaohongshu.com/explore/64cb12340000000001020304');
  assert.equal(note.author.name, '作者');
  assert.equal(note.coverUrl, 'https://sns-webpic-qc.xhscdn.com/a.jpg');
  assert.deepEqual(note.sourceImageUrls, ['https://sns-webpic-qc.xhscdn.com/a.jpg']);
  assert.equal(note.mediaStatus, 'pending');
});

test('noteFromSharedText rejects a bare link and accepts pasted content', () => {
  assert.throws(() => noteFromSharedText(sourceUrl), /单独拖入链接无法安全读取正文/);
  const note = noteFromSharedText(`这是标题\n这是已经复制出来的完整笔记正文内容\n${sourceUrl}`);
  assert.equal(note.title, '这是标题');
});

test('mergeImportedNote replaces duplicates', () => {
  const created = mergeImportedNote([{ id: 'old' }], { id: 'new', title: 'new' });
  assert.equal(created.created, true);
  const updated = mergeImportedNote(created.notes, { id: 'new', title: 'updated' });
  assert.equal(updated.created, false);
  assert.equal(updated.notes[0].title, 'updated');
});

test('removeStoredNote removes only the requested note', () => {
  const first = { id: 'first', title: 'first' };
  const second = { id: 'second', title: 'second' };
  const removed = removeStoredNote([first, second], 'first');
  assert.equal(removed.deletedNote, first);
  assert.deepEqual(removed.notes, [second]);

  const missing = removeStoredNote([second], 'missing');
  assert.equal(missing.deletedNote, null);
  assert.deepEqual(missing.notes, [second]);
});
