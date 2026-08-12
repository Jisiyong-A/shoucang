'use client';

import { Note } from '../../types/xiaohongshu';

export type MatchSource = 'TITLE' | 'BODY' | 'OCR' | 'TAGS' | 'AUTHOR';

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/\s+/g, ' ');
}

/**
 * Per-field match detection for a single note. Mirrors note-search token
 * semantics (AND over tokens) but reports WHERE the query hit.
 */
export function findMatchSources(note: Note, query: string): MatchSource[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const fields: Array<[MatchSource, string]> = [
    ['TITLE', note.title],
    ['BODY', [note.rawContent, note.content].filter(Boolean).join('\n')],
    ['OCR', [note.ocrText, ...(note.imageOcr || []).map((e) => e.text || '')].filter(Boolean).join('\n')],
    ['TAGS', (note.tags || []).join(' ')],
    ['AUTHOR', note.author?.name || ''],
  ];

  return fields
    .filter(([, text]) => tokens.every((token) => normalize(text).includes(token)))
    .map(([source]) => source);
}

/** Compact inline labels for card/search results. */
export function SearchResultMeta({ sources }: { sources: MatchSource[] }) {
  if (sources.length === 0) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {sources.map((source) => (
        <span
          key={source}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.06em',
            padding: '2px 5px',
            borderRadius: 4,
            border: '1px solid var(--line-strong)',
            color: 'var(--text-faint)',
            background: 'var(--surface-2)',
          }}
        >
          {source} MATCH
        </span>
      ))}
    </span>
  );
}
