import assert from 'node:assert/strict';
import test from 'node:test';

import { filterNotesByQuery, noteMatchesQuery } from './note-search.mjs';

const note = {
  id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  title: '博物馆网页设计',
  rawContent: '介绍胡同历史与沉浸式导览',
  ocrText: '',
  imageOcr: [{ text: '展期 2023.04—2023.06' }],
  author: { name: 'Leo Hong' },
  category: '设计美学',
  tags: ['网页设计', '传统文化'],
};

test('search covers body, image OCR, author, tags, and group names', () => {
  assert.equal(noteMatchesQuery(note, '胡同 沉浸式'), true);
  assert.equal(noteMatchesQuery(note, '2023.06'), true);
  assert.equal(noteMatchesQuery(note, 'leo hong'), true);
  assert.equal(noteMatchesQuery(note, '传统文化'), true);
  assert.equal(noteMatchesQuery(note, '客户灵感', '客户灵感'), true);
  assert.equal(noteMatchesQuery(note, '咖啡'), false);
});

test('filter returns all notes for an empty query', () => {
  assert.deepEqual(filterNotesByQuery([note], ''), [note]);
});

