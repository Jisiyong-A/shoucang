function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchableNoteText(note, extraText = '') {
  const imageOcr = Array.isArray(note?.imageOcr)
    ? note.imageOcr.map((entry) => entry?.text || '')
    : [];

  return normalizeSearchText([
    note?.title,
    note?.content,
    note?.rawContent,
    note?.ocrText,
    ...imageOcr,
    note?.author?.name,
    note?.category,
    ...(Array.isArray(note?.tags) ? note.tags : []),
    extraText,
  ].filter(Boolean).join('\n'));
}

export function noteMatchesQuery(note, query, extraText = '') {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const haystack = searchableNoteText(note, extraText);
  return normalizedQuery.split(' ').every((token) => haystack.includes(token));
}

export function filterNotesByQuery(notes, query, getExtraText) {
  if (!Array.isArray(notes)) return [];
  const resolveExtraText = typeof getExtraText === 'function' ? getExtraText : () => '';
  return notes.filter((note) => noteMatchesQuery(note, query, resolveExtraText(note)));
}
