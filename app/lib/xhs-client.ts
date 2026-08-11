import { Note } from '../types/xiaohongshu';
import { inferCategoryFromNote } from './category-inference.mjs';

type RawNote = Omit<Partial<Note>, 'savedAt' | 'type' | 'imageAspect'> & {
  savedAt?: unknown;
  type?: unknown;
  imageAspect?: unknown;
};

type NotesSource = 'embedded' | 'sidecar';

type RemoteNotesPayload =
  | {
      notes?: RawNote[];
      lastImportedAt?: unknown;
    }
  | RawNote[];

export type LocalServiceHealth = {
  ok: boolean;
  source: NotesSource;
};

export type AgentClient = 'codex' | 'claude';

export type LocalSetupInfo = {
  extension: {
    available: boolean;
    path: string | null;
    version: string | null;
  };
  agent: {
    available: boolean;
    serverPath: string | null;
    nodePath: string;
    dataDirectory: string;
    clients: Record<AgentClient, { available: boolean }>;
  };
};

export type ImportNoteResult = {
  notes: Note[];
  note: Note;
  created: boolean;
};

export type DeleteNoteResult = {
  notes: Note[];
  deletedId: string;
};

type NotesResponse = {
  notes: Note[];
  lastImportedAt: string | null;
  source: NotesSource;
};

const DEFAULT_LOCAL_API_BASE_URL = 'http://127.0.0.1:4318';
const CONFIGURED_LOCAL_API_BASE_URL = (process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const LOCAL_API_BASE_URL = CONFIGURED_LOCAL_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL;
const LOCAL_API_TIMEOUT_MS = 2500;

async function fetchLocalApi<T>(path: string, init?: RequestInit, timeoutMs: number = LOCAL_API_TIMEOUT_MS): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${LOCAL_API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = typeof errorPayload?.error === 'string'
        ? errorPayload.error
        : `Local API request failed: ${response.status}`;
      throw new Error(message);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function inferCategory(note: Partial<Note>): string {
  return inferCategoryFromNote(note);
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function normalizeNote(note: Partial<Note>): Note {
  const normalizedCategory = inferCategory(note);

  return {
    id: note.id || `${Date.now()}-${Math.random()}`,
    xsecToken: note.xsecToken,
    sourceUrl: note.sourceUrl,
    title: note.title || '未命名笔记',
    content: note.content || '',
    rawContent: note.rawContent || note.content || '',
    ocrText: note.ocrText || '',
    coverUrl: typeof note.coverUrl === 'string' ? note.coverUrl : '',
    imageUrls: Array.isArray(note.imageUrls) ? note.imageUrls.filter(Boolean) : [],
    sourceImageUrls: Array.isArray(note.sourceImageUrls) ? note.sourceImageUrls.filter(Boolean) : [],
    imageOcr: Array.isArray(note.imageOcr) ? note.imageOcr : [],
    mediaStatus: note.mediaStatus,
    mediaError: note.mediaError,
    author: {
      name: note.author?.name || '未知作者',
      avatar: note.author?.avatar,
      userId: note.author?.userId,
    },
    likes: typeof note.likes === 'number' ? note.likes : 0,
    collects: typeof note.collects === 'number' ? note.collects : 0,
    comments: typeof note.comments === 'number' ? note.comments : 0,
    category: normalizedCategory,
    savedAt: toDate(note.savedAt),
    tags: Array.isArray(note.tags) ? note.tags : [],
    type: note.type === 'video' ? 'video' : 'normal',
    imageAspect: note.imageAspect,
  };
}

function normalizeRemoteNotes(payload: RemoteNotesPayload): NotesResponse {
  if (Array.isArray(payload)) {
    return {
      notes: payload.map((note) => normalizeNote(note as Partial<Note>)),
      lastImportedAt: null,
      source: 'sidecar',
    };
  }

  return {
    notes: Array.isArray(payload.notes)
      ? payload.notes.map((note) => normalizeNote(note as Partial<Note>))
      : [],
    lastImportedAt: typeof payload.lastImportedAt === 'string' ? payload.lastImportedAt : null,
    source: 'sidecar',
  };
}

async function readEmbeddedNotes(): Promise<NotesResponse> {
  return {
    notes: [],
    lastImportedAt: null,
    source: 'embedded',
  };
}

async function readNotes(): Promise<NotesResponse> {
  try {
    const payload = await fetchLocalApi<RemoteNotesPayload>('/notes');
    return normalizeRemoteNotes(payload);
  } catch {
    return readEmbeddedNotes();
  }
}

export async function getLocalServiceHealth(): Promise<LocalServiceHealth> {
  try {
    const payload = await fetchLocalApi<{ ok?: boolean }>('/health');
    return {
      ok: payload.ok !== false,
      source: 'sidecar',
    };
  } catch {
    return {
      ok: false,
      source: 'sidecar',
    };
  }
}

export async function getLocalSetupInfo(): Promise<LocalSetupInfo> {
  return fetchLocalApi<LocalSetupInfo>('/setup', undefined, 8000);
}

export async function openBrowserExtensionSetup(): Promise<{ ok: boolean; path: string; message: string }> {
  return fetchLocalApi('/setup/browser-extension/open', { method: 'POST' }, 8000);
}

export async function connectLocalAgent(client: AgentClient): Promise<{ ok: boolean; message: string }> {
  return fetchLocalApi('/setup/agent/connect', {
    method: 'POST',
    body: JSON.stringify({ client }),
  }, 45_000);
}

export async function getNotes(): Promise<Note[]> {
  const response = await readNotes();
  return response.notes;
}

export async function importSharedNote(input: string): Promise<ImportNoteResult> {
  const payload = await fetchLocalApi<{
    notes?: RawNote[];
    note?: RawNote;
    created?: boolean;
    lastImportedAt?: unknown;
  }>('/notes/import', {
    method: 'POST',
    body: JSON.stringify({ input }),
  }, 180_000);

  const response = normalizeRemoteNotes(payload);
  const notes = response.notes;
  const importedId = typeof payload.note?.id === 'string' ? payload.note.id : '';
  const note = notes.find((entry) => entry.id === importedId);
  if (!note) {
    throw new Error('笔记已保存，但返回结果不完整');
  }

  return {
    notes,
    note,
    created: payload.created !== false,
  };
}

export async function deleteStoredNote(noteId: string): Promise<DeleteNoteResult> {
  const payload = await fetchLocalApi<{
    notes?: RawNote[];
    deletedId?: unknown;
    lastImportedAt?: unknown;
  }>(`/notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
  });

  const response = normalizeRemoteNotes(payload);
  return {
    notes: response.notes,
    deletedId: typeof payload.deletedId === 'string' ? payload.deletedId : noteId,
  };
}

export function formatNumber(num: number): string {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

export function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
