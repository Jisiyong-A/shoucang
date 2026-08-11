const INBOX_GROUP = {
  id: 'inbox',
  name: '待整理',
  kind: 'inbox',
};

function sanitizeGroupName(name) {
  const trimmed = String(name || '').trim();
  return trimmed || '新分组';
}

function createGroupId() {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAutoGroupId(category) {
  return `auto:${String(category || '未分类').trim() || '未分类'}`;
}

export function ensureDeskState(rawState, notes) {
  const safeNotes = Array.isArray(notes) ? notes : [];
  const noteIds = new Set(safeNotes.map((note) => note.id).filter(Boolean));
  const knownNoteIds = new Set(
    Array.isArray(rawState?.knownNoteIds)
      ? rawState.knownNoteIds.filter((noteId) => typeof noteId === 'string' && noteId.trim())
      : []
  );
  const categories = Array.from(
    new Set(
      safeNotes
        .map((note) => String(note?.category || '').trim())
        .filter(Boolean)
    )
  );
  const rawGroups = Array.isArray(rawState?.groups) ? rawState.groups : [];
  const normalizedGroups = rawGroups
    .filter((group) => group && typeof group.id === 'string' && group.id.trim() && group.id !== 'inbox')
    .map((group) => ({
      id: group.id.trim(),
      name: sanitizeGroupName(group.name),
      kind: group.kind === 'custom' ? 'custom' : 'auto',
      sourceCategory: typeof group.sourceCategory === 'string' ? group.sourceCategory.trim() : '',
    }));

  const autoGroups = categories.map((category) => {
    const existing = normalizedGroups.find(
      (group) => group.kind === 'auto' && (group.sourceCategory === category || group.id === createAutoGroupId(category))
    );

    return existing || {
      id: createAutoGroupId(category),
      name: category,
      kind: 'auto',
      sourceCategory: category,
    };
  });

  const customGroups = normalizedGroups.filter((group) => group.kind === 'custom');
  const groups = [...autoGroups, ...customGroups, INBOX_GROUP];
  const validGroupIds = new Set(groups.map((group) => group.id));
  const rawMap = rawState?.noteGroupMap && typeof rawState.noteGroupMap === 'object' ? rawState.noteGroupMap : {};
  const noteGroupMap = {};

  for (const note of safeNotes) {
    const nextGroupId = typeof rawMap[note.id] === 'string' ? rawMap[note.id] : '';
    if (validGroupIds.has(nextGroupId)) {
      noteGroupMap[note.id] = nextGroupId;
      continue;
    }

    const category = String(note?.category || '').trim();
    const autoGroup = groups.find((group) => group.kind === 'auto' && group.sourceCategory === category);
    const isKnownNote = knownNoteIds.has(note.id);
    noteGroupMap[note.id] = isKnownNote ? (autoGroup?.id || 'inbox') : (knownNoteIds.size > 0 ? 'inbox' : (autoGroup?.id || 'inbox'));
  }

  for (const noteId of Object.keys(noteGroupMap)) {
    if (!noteIds.has(noteId)) {
      delete noteGroupMap[noteId];
    }
  }

  const assignedGroupIds = new Set(Object.values(noteGroupMap));
  const populatedGroups = groups.filter(
    (group) => group.kind !== 'auto' || assignedGroupIds.has(group.id)
  );

  return {
    groups: populatedGroups,
    noteGroupMap,
    knownNoteIds: Array.from(noteIds),
  };
}

export function createDeskGroup(state, name) {
  const groups = Array.isArray(state?.groups) ? state.groups.filter((group) => group.id !== 'inbox') : [];

  return {
    ...state,
    groups: [
      ...groups,
      {
        id: createGroupId(),
        name: sanitizeGroupName(name),
        kind: 'custom',
        sourceCategory: '',
      },
      INBOX_GROUP,
    ],
  };
}

export function renameDeskGroup(state, groupId, name) {
  if (groupId === 'inbox') {
    return state;
  }

  return {
    ...state,
    groups: (state.groups || []).map((group) =>
      group.id === groupId
        ? { ...group, name: sanitizeGroupName(name) }
        : group
    ),
  };
}

export function moveNoteToGroup(state, noteId, groupId) {
  const validGroupIds = new Set((state.groups || []).map((group) => group.id));
  const nextGroupId = validGroupIds.has(groupId) ? groupId : 'inbox';

  return {
    ...state,
    noteGroupMap: {
      ...(state.noteGroupMap || {}),
      [noteId]: nextGroupId,
    },
  };
}

export function getNotesInGroup(notes, noteGroupMap, groupId) {
  return (Array.isArray(notes) ? notes : []).filter((note) => (noteGroupMap?.[note.id] || 'inbox') === groupId);
}
