#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { noteMatchesQuery } from './lib/note-search.mjs';

const SERVER_NAME = 'kankan-notes';
const SERVER_VERSION = '0.1.0';
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';
const defaultDataDirectory = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'com.patrick.kankanshoucang')
  : path.join(os.homedir(), '.kan-kan-shou-cang');
const dataDirectory = process.env.LOCAL_APP_DATA_DIR || defaultDataDirectory;
const legacyDataDirectory = path.join(os.homedir(), '.kan-kan-shou-cang');

function isUsableStoredNote(note) {
  return Boolean(
    note
    && typeof note.id === 'string'
    && note.id.trim()
    && (note.title || note.rawContent || note.coverUrl)
  );
}

async function readNotesFile(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    return Array.isArray(raw) ? raw.filter(isUsableStoredNote) : [];
  } catch {
    return [];
  }
}

async function readNotes() {
  const currentPath = path.join(dataDirectory, 'notes.json');
  const legacyPath = path.join(legacyDataDirectory, 'notes.json');
  const [currentNotes, legacyNotes] = await Promise.all([
    readNotesFile(currentPath),
    path.resolve(dataDirectory) === path.resolve(legacyDataDirectory)
      ? Promise.resolve([])
      : readNotesFile(legacyPath),
  ]);
  const merged = new Map(currentNotes.map((note) => [note.id, note]));
  for (const note of legacyNotes) {
    if (!merged.has(note.id)) merged.set(note.id, note);
  }
  return Array.from(merged.values());
}

function noteExcerpt(note) {
  return String(note.rawContent || note.content || note.ocrText || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
}

function compactNote(note) {
  return {
    id: note.id,
    title: note.title || '未命名笔记',
    author: note.author?.name || '未知作者',
    category: note.category || '待分类',
    tags: Array.isArray(note.tags) ? note.tags : [],
    savedAt: note.savedAt || null,
    excerpt: noteExcerpt(note),
  };
}

function fullNote(note) {
  return {
    ...compactNote(note),
    sourceUrl: note.sourceUrl || null,
    content: note.rawContent || note.content || '',
    ocrText: note.ocrText || '',
    imageOcr: Array.isArray(note.imageOcr)
      ? note.imageOcr.map((entry, index) => ({
          image: index + 1,
          text: entry?.text || '',
        })).filter((entry) => entry.text)
      : [],
    imageCount: Array.isArray(note.imageUrls) ? note.imageUrls.length : 0,
  };
}

const tools = [
  {
    name: 'search_saved_notes',
    description: '搜索“看看收藏”里已经保存到本机的笔记。覆盖标题、正文、图片 OCR、标签、作者和分类；不会访问小红书账号或网络。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '自然语言关键词；多个词会同时匹配。留空时返回最近保存的笔记。' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 8 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'read_saved_note',
    description: '按笔记 ID 读取一条已保存笔记的完整正文和图片 OCR 文本。只读本机数据。',
    inputSchema: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: 'search_saved_notes 返回的笔记 ID。' },
      },
      required: ['note_id'],
      additionalProperties: false,
    },
  },
];

function toolResult(payload, text = JSON.stringify(payload, null, 2)) {
  return {
    content: [{ type: 'text', text }],
    structuredContent: payload,
  };
}

async function callTool(name, args = {}) {
  const notes = await readNotes();

  if (name === 'search_saved_notes') {
    const query = typeof args.query === 'string' ? args.query : '';
    const limit = Math.min(50, Math.max(1, Number.parseInt(args.limit || '8', 10) || 8));
    const matches = notes
      .filter((note) => noteMatchesQuery(note, query))
      .sort((left, right) => new Date(right.savedAt || 0).getTime() - new Date(left.savedAt || 0).getTime())
      .slice(0, limit)
      .map(compactNote);
    const payload = { query, count: matches.length, notes: matches };
    return toolResult(payload, matches.length
      ? JSON.stringify(payload, null, 2)
      : `没有找到与“${query}”匹配的本地笔记。`);
  }

  if (name === 'read_saved_note') {
    const noteId = typeof args.note_id === 'string' ? args.note_id.trim().toLowerCase() : '';
    const note = notes.find((entry) => entry.id.toLowerCase() === noteId);
    if (!note) {
      return {
        ...toolResult({ note_id: noteId, found: false }, `没有找到 ID 为 ${noteId || '空'} 的本地笔记。`),
        isError: true,
      };
    }
    return toolResult({ found: true, note: fullNote(note) });
  }

  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
}

async function handleRequest(message) {
  switch (message.method) {
    case 'initialize':
      return {
        protocolVersion: message.params?.protocolVersion || DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions: '这是“看看收藏”的本地只读笔记库。需要相关资料时先调用 search_saved_notes，再按需调用 read_saved_note。不得把这些工具描述成小红书账号访问；它们只读取用户已经保存到本机的内容。',
      };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools };
    case 'tools/call':
      return callTool(message.params?.name, message.params?.arguments || {});
    default:
      throw Object.assign(new Error(`Method not found: ${message.method}`), { code: -32601 });
  }
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    void (async () => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        writeMessage({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        return;
      }

      if (message.id === undefined) return;
      try {
        writeMessage({ jsonrpc: '2.0', id: message.id, result: await handleRequest(message) });
      } catch (error) {
        writeMessage({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: Number.isInteger(error?.code) ? error.code : -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        });
      }
    })();
  }
});

