'use client';

/**
 * Embedded local semantic search.
 *
 * - Model: BAAI/bge-small-zh-v1.5 (MIT) — int8 ONNX, shipped inside the
 *   app bundle (app/public/models/), NO network needed at runtime.
 * - Inference: @huggingface/transformers (Apache-2.0) running in WASM
 *   inside the WebView — nothing leaves the machine.
 * - Indexing: notes are embedded in the background (idle-time batching)
 *   and vectors are cached in IndexedDB (512 floats ≈ 2 KB/note).
 * - Search: query embedding → cosine similarity → top-K.
 * - Degradation: if the model/WASM fails to load, the caller falls back
 *   to the TF-IDF search already in place.
 */
import { env, pipeline } from '@huggingface/transformers';

env.allowLocalModels = true;
env.localModelPath = '/models/';

const MODEL_ID = 'multilingual-e5-base';
const EMBEDDING_DIM = 768;
const DB_NAME = 'shoucang-semantic';
const DB_STORE = 'vectors';
// v3: e5-base -> 768-d; bump wipes stale v1/v2 (512d/1024d) vectors.
const DB_VERSION = 3;

let embedderPromise = null;
let cacheDbPromise = null;

function openCacheDb() {
  if (cacheDbPromise) return cacheDbPromise;
  cacheDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // v2: e5 model -> 1024-d vectors; wipe any v1 (512-d bge) cache.
      if (db.objectStoreNames.contains(DB_STORE)) {
        db.deleteObjectStore(DB_STORE);
      }
      db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return cacheDbPromise;
}

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', MODEL_ID).catch((error) => {
      embedderPromise = null;
      throw error;
    });
  }
  return embedderPromise;
}

/** Mean-pool + L2-normalize the model output into a 512-d vector. */
function normalizeEmbedding(output) {
  const data = output.data;
  const dim = EMBEDDING_DIM;
  const numTokens = Math.floor(data.length / dim);
  if (numTokens === 0) return null;
  const vector = new Float32Array(dim);
  for (let token = 0; token < numTokens; token += 1) {
    const offset = token * dim;
    for (let i = 0; i < dim; i += 1) vector[i] += data[offset + i];
  }
  let norm = 0;
  for (let i = 0; i < dim; i += 1) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i += 1) vector[i] /= norm;
  return vector;
}

/** Embed a single text into a normalized vector.
 *  e5 models use role prefixes: 'query: ' for search input,
 *  'passage: ' for indexed documents. */
export async function embedText(text, role = 'query') {
  const embedder = await getEmbedder();
  const prefix = role === 'passage' ? 'passage: ' : 'query: ';
  const truncated = String(text || '').slice(0, 800);
  if (!truncated.trim()) return null;
  const output = await embedder(prefix + truncated, { pooling: 'none', normalize: false });
  return normalizeEmbedding(output);
}

export async function getCachedVector(noteId) {
  try {
    const db = await openCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const request = tx.objectStore(DB_STORE).get(noteId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function putCachedVector(noteId, vector) {
  try {
    const db = await openCacheDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(vector, noteId);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // cache is best-effort
  }
}

export function noteEmbeddingText(note) {
  return [
    note.title || '',
    note.rawContent || '',
    note.ocrText || '',
    (note.tags || []).join(' '),
    note.author?.name || '',
  ].join('\n');
}

/** Background indexing: embed notes in idle batches; stops when done. */
export async function indexNotesInBackground(notes, { onProgress } = {}) {
  try {
    await getEmbedder();
  } catch {
    return { indexed: 0, failed: true };
  }

  let indexed = 0;
  for (const note of notes) {
    if (!note?.id) continue;
    const existing = await getCachedVector(note.id);
    if (existing) {
      indexed += 1;
      continue;
    }
    const vector = await embedText(noteEmbeddingText(note), 'passage');
    if (vector) {
      await putCachedVector(note.id, vector);
      indexed += 1;
    }
    // yield to the UI thread periodically (one note per idle slice)
    await new Promise((resolve) => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => resolve(), { timeout: 2000 });
      } else {
        setTimeout(resolve, 30);
      }
    });
    onProgress?.(indexed, notes.length);
  }
  return { indexed, failed: false };
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Semantic search over the archive using cached embeddings.
 * Returns [{ note, score }] sorted desc; empty on any failure.
 */
export async function semanticSearchEmbedded(notes, query, { limit = 50 } = {}) {
  try {
    const queryVector = await embedText(query);
    if (!queryVector) return [];
    const scored = [];
    for (const note of notes) {
      if (!note?.id) continue;
      const vector = await getCachedVector(note.id);
      if (!vector) continue;
      const score = cosine(queryVector, vector);
      if (score > 0.35) scored.push({ note, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  } catch {
    return [];
  }
}

export async function semanticIndexStatus(notes) {
  try {
    let cached = 0;
    for (const note of notes) {
      if (await getCachedVector(note.id)) cached += 1;
    }
    return { cached, total: notes.length };
  } catch {
    return { cached: 0, total: notes.length };
  }
}
