import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDeskGroup,
  ensureDeskState,
  moveNoteToGroup,
  renameDeskGroup,
} from '../../app/lib/desk-workspace.mjs';

const notes = [
  { id: 'n1', title: '第一条', category: '阅读思考' },
  { id: 'n2', title: '第二条', category: 'AI工具' },
  { id: 'n3', title: '第三条', category: '阅读思考' },
];

test('ensureDeskState restores auto category groups and keeps existing assignments', () => {
  const state = ensureDeskState(
    {
      groups: [{ id: 'auto:阅读思考', name: '阅读', kind: 'auto', sourceCategory: '阅读思考' }],
      noteGroupMap: {
        n1: 'auto:阅读思考',
        ghost: 'auto:阅读思考',
      },
    },
    notes
  );

  assert.equal(state.groups[0].id, 'auto:阅读思考');
  assert.equal(state.groups[1].id, 'auto:AI工具');
  assert.equal(state.groups.at(-1).id, 'inbox');
  assert.equal(state.noteGroupMap.n1, 'auto:阅读思考');
  assert.equal(state.noteGroupMap.n2, 'auto:AI工具');
  assert.equal(state.noteGroupMap.n3, 'auto:阅读思考');
  assert.equal(state.noteGroupMap.ghost, undefined);
});

test('ensureDeskState sends newly synced notes to inbox after workspace already exists', () => {
  const base = ensureDeskState({}, notes);
  const nextNotes = [...notes, { id: 'n4', title: '第四条', category: 'AI工具' }];
  const next = ensureDeskState(base, nextNotes);

  assert.equal(next.noteGroupMap.n1, 'auto:阅读思考');
  assert.equal(next.noteGroupMap.n2, 'auto:AI工具');
  assert.equal(next.noteGroupMap.n4, 'inbox');
});

test('ensureDeskState does not create an empty auto group for a new inbox note', () => {
  const base = ensureDeskState({}, notes);
  const next = ensureDeskState(base, [
    ...notes,
    { id: 'n4', title: '第四条', category: '方法论' },
  ]);

  assert.equal(next.noteGroupMap.n4, 'inbox');
  assert.equal(next.groups.some((group) => group.id === 'auto:方法论'), false);
});

test('ensureDeskState preserves renamed auto group names', () => {
  const base = ensureDeskState({}, notes);
  const renamed = renameDeskGroup(base, 'auto:阅读思考', '阅读方法');
  const next = ensureDeskState(renamed, notes);

  assert.equal(next.groups.find((group) => group.id === 'auto:阅读思考').name, '阅读方法');
});

test('createDeskGroup appends a new editable group without disturbing existing notes', () => {
  const base = ensureDeskState({}, notes);
  const next = createDeskGroup(base, '新分组');

  assert.equal(next.groups.some((group) => group.name === '新分组'), true);
  assert.equal(next.noteGroupMap.n1, 'auto:阅读思考');
});

test('renameDeskGroup trims names and ignores inbox', () => {
  const base = createDeskGroup(ensureDeskState({}, notes), '待改名');
  const customGroup = base.groups.find((group) => group.name === '待改名');
  const renamed = renameDeskGroup(base, customGroup.id, '  阅读思考  ');
  const inboxRename = renameDeskGroup(renamed, 'inbox', '别改我');

  assert.equal(renamed.groups.find((group) => group.id === customGroup.id).name, '阅读思考');
  assert.equal(inboxRename.groups.at(-1).name, '待整理');
});

test('moveNoteToGroup falls back to inbox when target group is missing', () => {
  const base = createDeskGroup(ensureDeskState({}, notes), '方法论');
  const groupId = base.groups.find((group) => group.name === '方法论').id;
  const moved = moveNoteToGroup(base, 'n2', groupId);
  const fallback = moveNoteToGroup(moved, 'n2', 'missing-group');

  assert.equal(moved.noteGroupMap.n2, groupId);
  assert.equal(fallback.noteGroupMap.n2, 'inbox');
});
