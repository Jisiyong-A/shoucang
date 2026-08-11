import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acceptsExternalNoteDrag,
  parseDraggedCardInput,
  selectDraggedNoteInput,
} from '../../app/lib/drag-import.mjs';

test('accepts browser URL drags as well as extension payload drags', () => {
  assert.equal(acceptsExternalNoteDrag(['text/uri-list']), true);
  assert.equal(acceptsExternalNoteDrag(['application/x-kankan-note']), true);
  assert.equal(acceptsExternalNoteDrag(['application/x-kankan-card']), true);
  assert.equal(acceptsExternalNoteDrag(['Files']), false);
});

test('keeps a directly dragged Xiaohongshu card payload intact', () => {
  const payload = 'KANKAN_CARD:{"id":"64cb12340000000001020304","sourceUrl":"https://www.xiaohongshu.com/explore/64cb12340000000001020304","title":"卡片标题"}';
  assert.equal(selectDraggedNoteInput({ custom: payload, uriList: 'https://example.com' }), payload);
  assert.deepEqual(parseDraggedCardInput(payload), {
    id: '64cb12340000000001020304',
    sourceUrl: 'https://www.xiaohongshu.com/explore/64cb12340000000001020304',
    title: '卡片标题',
  });
  assert.deepEqual(
    parseDraggedCardInput('https://www.xiaohongshu.com/search_result/64cb12340000000001020304?xsec_token=abc'),
    {
      id: '64cb12340000000001020304',
      sourceUrl: 'https://www.xiaohongshu.com/search_result/64cb12340000000001020304?xsec_token=abc',
      title: '',
    },
  );
});

test('prefers the complete extension payload over a URL', () => {
  const payload = 'KANKAN_NOTE:{"id":"64cb12340000000001020304","title":"测试"}';
  assert.equal(selectDraggedNoteInput({ plain: payload, uriList: 'https://www.xiaohongshu.com/explore/64cb12340000000001020304' }), payload);
  assert.equal(selectDraggedNoteInput({ custom: payload, plain: 'https://example.com' }), payload);
});

test('falls back to the first usable URL for a plain browser drag', () => {
  assert.equal(selectDraggedNoteInput({
    uriList: '# dragged link\nhttps://www.xiaohongshu.com/explore/64cb12340000000001020304\n',
  }), 'https://www.xiaohongshu.com/explore/64cb12340000000001020304');
});
