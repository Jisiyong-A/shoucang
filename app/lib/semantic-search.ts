'use client';

/**
 * Local semantic-ish search over the archive: Chinese bigram tokens,
 * TF-IDF weighting, cosine similarity. Zero dependencies, runs entirely
 * in the browser on the already-loaded notes — instant, offline, private.
 *
 * This is vocabulary-level semantics (word overlap with idf weighting),
 * not deep meaning; it complements the exact-match filter in xhs-client.
 */

export function tokenizeChinese(text: string): string[] {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[a-z0-9]+/g, (latin) => ` ${latin} `)
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ');
  const parts = normalized.split(/\s+/).filter(Boolean);
  const tokens = [];
  for (const part of parts) {
    if (/^[a-z0-9]+$/.test(part)) {
      tokens.push(part);
    } else {
      // CJK: emit bigrams (and unigrams for short strings)
      const chars = [...part];
      if (chars.length === 1) {
        tokens.push(chars[0]);
      } else {
        for (let i = 0; i < chars.length - 1; i += 1) {
          tokens.push(chars[i] + chars[i + 1]);
        }
      }
    }
  }
  return tokens;
}

export function buildDocumentVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  const vector = new Map();
  for (const [token, count] of counts) {
    const weight = (idf.get(token) || 0) * (1 + Math.log(count));
    if (weight > 0) vector.set(token, weight);
  }
  return vector;
}

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [token, weight] of a) {
    normA += weight * weight;
    const other = b.get(token);
    if (other !== undefined) dot += weight * other;
  }
  for (const weight of b.values()) normB += weight * weight;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Search notes semantically. Returns notes sorted by relevance. */
export function semanticSearchNotes<T extends { id?: string; title?: string; rawContent?: string; ocrText?: string; tags?: string[]; author?: { name?: string } }>(
  notes: T[],
  query: string,
  { limit = 200 }: { limit?: number } = {},
): T[] {
  const queryTokens = tokenizeChinese(query);
  if (queryTokens.length === 0) return [];

  // corpus idf over title + body + ocr
  const documentFrequency = new Map();
  const documents = notes.map((note) => {
    const fields = [
      note.title || '',
      note.rawContent || '',
      note.ocrText || '',
      (note.tags || []).join(' '),
      note.author?.name || '',
    ].join('\n');
    const tokens = tokenizeChinese(fields);
    const unique = new Set(tokens);
    for (const token of unique) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
    return { note, tokens };
  });
  const total = Math.max(documents.length, 1);
  const idf = new Map();
  for (const [token, freq] of documentFrequency) {
    idf.set(token, Math.log(1 + total / freq));
  }

  const queryVector = buildDocumentVector(queryTokens, idf);
  const scored = documents
    .map(({ note, tokens }) => ({
      note,
      score: cosineSimilarity(queryVector, buildDocumentVector(tokens, idf)),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.note);
  return scored;
}

/** Combined: exact-match results first (preserving their order), then
 *  semantic-only hits that exact matching missed. */
export function hybridSearchNotes<T extends { id?: string }>(
  notes: T[],
  query: string,
  exactMatch: (note: T) => boolean = () => false,
): T[] {
  const exact = notes.filter(exactMatch);
  const exactIds = new Set(exact.map((note) => note.id));
  const semantic = semanticSearchNotes(notes, query).filter(
    (note) => !exactIds.has(note.id),
  );
  return [...exact, ...semantic];
}
