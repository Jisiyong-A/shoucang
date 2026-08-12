import { createServer } from 'node:http';
import { copyFileSync, createReadStream, existsSync, readdirSync } from 'node:fs';
import { stat as fsStat } from 'node:fs/promises';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { inferCategoryFromNote } from './lib/category-inference.mjs';
import { recoverCachedNoteCovers } from './lib/cache-cover-recovery.mjs';
import { localizeNoteMedia } from './lib/media-import.mjs';
import { probeLocalOcr } from './ocr/index.mjs';
import * as platform from './platform/index.mjs';
import { resolveAnonymousNote } from './lib/anonymous-note-resolver.mjs';
import { classifyWithAI } from './lib/ai-classifier.mjs';
import {
  extractNoteIdFromUrl,
  extractSharedNoteUrl,
  mergeImportedNote,
  normalizeImportedNote,
  noteFromSharedText,
  parseDraggedCardInput,
  parseDraggedNoteInput,
  removeStoredNote,
} from './lib/note-import.mjs';

const DEFAULT_PORT = 4318;
const MCP_SERVER_NAME = 'shoucang-notes';
const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.LOCAL_API_PORT || `${DEFAULT_PORT}`, 10);
const defaultDataDirectory = platform.dataDirectory();
const dataDirectory = process.env.LOCAL_APP_DATA_DIR || defaultDataDirectory;
const legacyDataDirectory = platform.legacyDataDirectory();
const notesFilePath = path.join(dataDirectory, 'notes.json');
const legacyNotesFilePath = path.join(legacyDataDirectory, 'notes.json');
const notesTempFilePath = path.join(dataDirectory, 'notes.next.json');
const mediaDirectory = path.join(dataDirectory, 'media');
const publicBaseUrl = `http://127.0.0.1:${PORT}`;
const coverCacheDirectories = process.platform === 'darwin'
  ? [
      path.join(os.homedir(), 'Library', 'Caches', 'com.patrick.shoucang', 'WebKit', 'NetworkCache'),
      path.join(os.homedir(), 'Library', 'Caches', 'shoucang', 'WebKit', 'NetworkCache'),
    ]
  : [];
let mutationQueue = Promise.resolve();
let ocrStatus = { engine: process.platform === 'darwin' ? 'vision' : null, available: process.platform === 'darwin', languages: [], error: null };
let extensionLastSeen = 0;
// A 60s window made CONNECTED flake out while the user simply reads the
// settings page (heartbeats only fire when a XHS page loads). 6h = "the
// extension has been seen working today" — stable, still honest.
// Persisted to the data dir so an app reinstall does not reset it.
const EXTENSION_HEARTBEAT_WINDOW_MS = 6 * 60 * 60 * 1000;
const EXTENSION_LAST_SEEN_FILE = 'extension-last-seen.json';

async function loadExtensionLastSeen() {
  try {
    const raw = JSON.parse(
      await readFile(path.join(dataDirectory, EXTENSION_LAST_SEEN_FILE), 'utf8'),
    );
    if (typeof raw.lastSeen === 'number') extensionLastSeen = raw.lastSeen;
  } catch {
    // first run or unreadable — leave 0
  }
}

async function persistExtensionLastSeen() {
  try {
    await writeFile(
      path.join(dataDirectory, EXTENSION_LAST_SEEN_FILE),
      JSON.stringify({ lastSeen: Date.now() }),
      'utf8',
    );
  } catch {
    // non-fatal: memory-only CONNECTED still works this session
  }
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function resolveExtensionDirectory() {
  const candidates = [
    path.resolve(scriptDirectory, '../browser-extension'),
    path.resolve(scriptDirectory, 'browser-extension'),
    path.resolve(process.cwd(), 'browser-extension'),
  ];
  return firstExistingPath(candidates.filter((candidate) => existsSync(path.join(candidate, 'manifest.json'))));
}

function resolveMcpServerPath() {
  return firstExistingPath([
    path.resolve(scriptDirectory, 'shoucang-mcp.mjs'),
    path.resolve(scriptDirectory, '../scripts/shoucang-mcp.mjs'),
  ]);
}

async function resolveAgentExecutable(client) {
  return platform.resolveAgentExecutable(client);
}

async function buildSetupResponse() {
  // Refresh agent connection state on every /setup read so a stale
  // startup probe can't leave the UI showing wrong CONNECTED status.
  probeConnectedAgents().catch(() => {});
  const extensionDirectory = resolveExtensionDirectory();
  const mcpServerPath = resolveMcpServerPath();
  const [codexPath, claudePath, hermesPath] = await Promise.all([
    resolveAgentExecutable('codex'),
    resolveAgentExecutable('claude'),
    resolveAgentExecutable('hermes'),
  ]);
  let extensionVersion = null;
  if (extensionDirectory) {
    try {
      extensionVersion = JSON.parse(await readFile(path.join(extensionDirectory, 'manifest.json'), 'utf8')).version || null;
    } catch {
      extensionVersion = null;
    }
  }

  const browsers = platform.detectBrowsers();

  return {
    extension: {
      available: Boolean(extensionDirectory),
      path: extensionDirectory,
      version: extensionVersion,
      connected: Boolean(extensionDirectory) && Date.now() - extensionLastSeen < EXTENSION_HEARTBEAT_WINDOW_MS,
      browsers,
    },
    agent: {
      available: Boolean(mcpServerPath),
      serverPath: mcpServerPath,
      nodePath: process.execPath,
      dataDirectory,
      clients: {
        hermes: {
          available: Boolean(hermesPath),
          connected: connectedAgents.has('hermes'),
        },
        codex: {
          available: Boolean(codexPath),
          connected: connectedAgents.has('codex'),
        },
        claude: {
          available: Boolean(claudePath),
          connected: connectedAgents.has('claude'),
        },
      },
      manualConfig: {
        name: MCP_SERVER_NAME,
        command: process.execPath,
        args: [mcpServerPath],
        env: { LOCAL_APP_DATA_DIR: dataDirectory },
      },
    },
  };
}

let connectedAgents = new Set();
let probePromise = null;
let lastProbeDoneAt = 0;
let lastProbeFailedAt = 0;
const PROBE_TTL_MS = 30_000;
const PROBE_RETRY_MS = 15_000;

/** Probe whether an agent already has the MCP server registered.
 * Cached with a 30s TTL; the result Set is swapped atomically when the
 * probe finishes, so readers always observe the last completed state.
 * A failed probe retries after a short backoff instead of leaving the
 * UI showing a stale "disconnected". */
async function probeConnectedAgents(force = false) {
  const now = Date.now();
  const lastDone = lastProbeDoneAt;
  const lastFailed = lastProbeFailedAt;
  if (!force && now - lastDone < PROBE_TTL_MS) return;
  if (!force && lastFailed > lastDone && now - lastFailed < PROBE_RETRY_MS) return;
  if (probePromise) return probePromise;
  probePromise = (async () => {
    const fresh = new Set();
    const probes = [
      ['codex', ['mcp', 'list']],
      ['claude', ['mcp', 'list', '--scope', 'user']],
      ['hermes', ['mcp', 'list']],
    ];
    let anyFailure = false;
    for (const [client, args] of probes) {
      try {
        const executable = await resolveAgentExecutable(client);
        if (!executable) { console.log(`[probe] ${client}: no executable`); continue; }
        const { stdout } = await execFileAsync(executable, args, { timeout: 8000, maxBuffer: 1024 * 1024 });
        console.log(`[probe] ${client}: contains=${stdout.includes(MCP_SERVER_NAME)} bytes=${stdout.length}`);
        if (stdout.includes(MCP_SERVER_NAME)) fresh.add(client);
      } catch (err) {
        anyFailure = true;
        console.log(`[probe] ${client}: FAILED ${String(err.message).slice(0, 120)}`);
      }
    }
    connectedAgents = fresh;
    lastProbeDoneAt = Date.now();
    if (anyFailure) lastProbeFailedAt = Date.now();
  })().finally(() => { probePromise = null; });
  return probePromise;
}

async function backupHermesConfig() {
  const roots = [path.join(os.homedir(), 'AppData', 'Local', 'hermes')];
  const candidates = [];
  for (const root of roots) {
    for (const name of ['config.yaml', 'config.yml', 'config.json']) {
      const file = path.join(root, name);
      if (existsSync(file)) candidates.push(file);
    }
  }
  const profilesDir = path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'profiles');
  if (existsSync(profilesDir)) {
    for (const entry of readdirSync(profilesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const name of ['config.yaml', 'config.yml', 'config.json']) {
        const file = path.join(profilesDir, entry.name, name);
        if (existsSync(file)) candidates.push(file);
      }
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const file of candidates) {
    copyFileSync(file, `${file}.shoucang-backup-${stamp}`);
  }
  return candidates.length;
}

async function connectAgentClient(client) {
  if (client !== 'codex' && client !== 'claude' && client !== 'hermes') {
    throw new Error('不支持的 Agent 客户端');
  }
  const executable = await resolveAgentExecutable(client);
  if (!executable) {
    const names = { codex: 'Codex CLI', claude: 'Claude Code', hermes: 'Hermes' };
    throw new Error(`没有找到 ${names[client]}`);
  }
  const mcpServerPath = resolveMcpServerPath();
  if (!mcpServerPath) throw new Error('本地 Agent 服务文件不存在');

  const removeArgs = client === 'codex'
    ? ['mcp', 'remove', MCP_SERVER_NAME]
    : client === 'claude'
      ? ['mcp', 'remove', '--scope', 'user', MCP_SERVER_NAME]
      : ['mcp', 'remove', MCP_SERVER_NAME];
  try {
    await execFileAsync(executable, removeArgs, { timeout: 15000, maxBuffer: 512 * 1024 });
  } catch {
    // A missing previous configuration is expected on first setup.
  }

  // Hermes config backup before any modification (Task 06 §3).
  if (client === 'hermes') {
    await backupHermesConfig();
  }

  if (client === 'hermes') {
    // hermes mcp add is discovery-first: it prompts for tool selection.
    // Answer the prompt non-interactively (accept all tools).
    await new Promise((resolve, reject) => {
      const child = spawn(executable, [
        'mcp', 'add', MCP_SERVER_NAME,
        '--command', process.execPath,
        '--env', `LOCAL_APP_DATA_DIR=${dataDirectory}`,
        '--args', mcpServerPath,
      ], { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
      const timer = setTimeout(() => { child.kill(); reject(new Error('hermes mcp add 超时')); }, 45000);
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk;
        // answer tool-selection prompts as they appear
        if (/\[y\/n\]|\(Y\/n\)|\[Y\/n\]/i.test(out) || /启用|use tool|enable/i.test(out.slice(-120))) {
          child.stdin.write('Y\n');
        }
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`hermes mcp add 退出码 ${code}: ${out.slice(-400)}`));
      });
    });
  } else {
    const addArgs = client === 'codex'
      ? ['mcp', 'add', MCP_SERVER_NAME, '--env', `LOCAL_APP_DATA_DIR=${dataDirectory}`, '--', process.execPath, mcpServerPath]
      : ['mcp', 'add', '--scope', 'user', MCP_SERVER_NAME, '-e', `LOCAL_APP_DATA_DIR=${dataDirectory}`, '--', process.execPath, mcpServerPath];
    await execFileAsync(executable, addArgs, { timeout: 30000, maxBuffer: 1024 * 1024 });
  }
  connectedAgents.add(client);

  return {
    ok: true,
    client,
    serverName: MCP_SERVER_NAME,
    message: client === 'codex'
      ? 'Codex 已连接，重新打开一个任务后可使用'
      : 'Claude Code 已连接，重新打开一个会话后可使用',
  };
}

const mediaContentTypes = new Map([
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.heic', 'image/heic'],
  ['.heif', 'image/heif'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.mp4', 'video/mp4'],
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin.startsWith('chrome-extension://')) return true;

  try {
    const url = new URL(origin);
    return url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || url.hostname === 'tauri.localhost'
      || url.protocol === 'tauri:';
  } catch {
    return false;
  }
}

function applyCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function sendJson(request, response, statusCode, payload) {
  applyCorsHeaders(request, response);
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function isUsableStoredNote(note) {
  return Boolean(
    note
    && typeof note.id === 'string'
    && note.id.trim()
    && (note.title || note.rawContent || note.coverUrl)
  );
}

async function ensureDataDirectory() {
  await Promise.all([
    mkdir(dataDirectory, { recursive: true }),
    mkdir(mediaDirectory, { recursive: true }),
  ]);
}

async function readNotesFile(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    return Array.isArray(raw) ? raw.filter(isUsableStoredNote) : [];
  } catch (error) {
    // Corrupt archive must not crash the app, but must stay diagnosable.
    console.error(`[shoucang] notes.json 解析失败（${filePath}）:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function readNotes() {
  await ensureDataDirectory();
  const [currentNotes, legacyNotes] = await Promise.all([
    readNotesFile(notesFilePath),
    path.resolve(dataDirectory) === path.resolve(legacyDataDirectory)
      ? Promise.resolve([])
      : readNotesFile(legacyNotesFilePath),
  ]);
  const merged = new Map(currentNotes.map((note) => [note.id, note]));
  for (const note of legacyNotes) {
    if (!merged.has(note.id)) merged.set(note.id, note);
  }
  return Array.from(merged.values());
}

async function writeNotes(notes) {
  await ensureDataDirectory();
  await writeFile(notesTempFilePath, `${JSON.stringify(notes, null, 2)}\n`, 'utf8');
  await rename(notesTempFilePath, notesFilePath);
}

async function writeLegacyNotes(notes) {
  const legacyTempFilePath = path.join(legacyDataDirectory, 'notes.next.json');
  await mkdir(legacyDataDirectory, { recursive: true });
  await writeFile(legacyTempFilePath, `${JSON.stringify(notes, null, 2)}\n`, 'utf8');
  await rename(legacyTempFilePath, legacyNotesFilePath);
}

async function readRequestBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.length;
    if (totalBytes > 2 * 1024 * 1024) {
      throw new Error('导入内容过大');
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('导入数据格式不正确');
  }
}

function getLastImportedAt(notes) {
  const timestamps = notes
    .map((note) => new Date(note.savedAt || 0).getTime())
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

async function buildNotesResponse() {
  const notes = await readNotes();
  return {
    notes,
    lastImportedAt: getLastImportedAt(notes),
  };
}

async function importNote(body = {}) {
  const draggedPayload = body.note || parseDraggedNoteInput(body.input);
  const draggedCard = draggedPayload ? null : parseDraggedCardInput(body.input);
  let normalized;

  if (draggedPayload) {
    normalized = normalizeImportedNote(draggedPayload);
  } else if (draggedCard) {
    const resolved = await resolveAnonymousNote(draggedCard.sourceUrl, {
      expectedNoteId: draggedCard.id,
    });
    normalized = normalizeImportedNote({
      ...resolved,
      title: resolved.title || draggedCard.title,
    });
  } else {
    try {
      normalized = noteFromSharedText(body.input);
    } catch (error) {
      const sourceUrl = extractSharedNoteUrl(body.input);
      const noteId = extractNoteIdFromUrl(sourceUrl);
      if (!noteId) throw error;
      normalized = normalizeImportedNote(await resolveAnonymousNote(sourceUrl, {
        expectedNoteId: noteId,
      }));
    }
  }
  const imported = await localizeNoteMedia(normalized, {
    mediaDirectory,
    publicBaseUrl,
  });
  const note = {
    ...imported,
    category: inferCategoryFromNote(imported),
    savedAt: new Date().toISOString(),
  };

  const existingNotes = await readNotes();
  const merged = mergeImportedNote(existingNotes, note);
  await writeNotes(merged.notes);

  // Async AI re-classification: best-effort, never blocks the import,
  // falls back to the rule-based category already assigned above.
  void (async () => {
    try {
      const result = await classifyWithAI(note);
      if (!result.ok || !result.category) return;
      const stored = await readNotes();
      const target = stored.find((entry) => entry?.id === note.id);
      if (!target || target.category === result.category) return;
      target.category = result.category;
      await writeNotes(stored);
      console.log(`[kankan] AI 分类: ${note.id.slice(0, 8)} -> ${result.category}`);
    } catch {
      // classification is optional; keep the rule-based category
    }
  })();

  return {
    notes: merged.notes,
    note,
    created: merged.created,
    lastImportedAt: note.savedAt,
  };
}

async function deleteNote(noteId) {
  const existingNotes = await readNotes();
  const removed = removeStoredNote(existingNotes, noteId);
  if (!removed.deletedNote) return null;

  if (path.resolve(dataDirectory) !== path.resolve(legacyDataDirectory) && existsSync(legacyNotesFilePath)) {
    const legacyNotes = await readNotesFile(legacyNotesFilePath);
    const legacyRemoved = removeStoredNote(legacyNotes, noteId);
    if (legacyRemoved.deletedNote) await writeLegacyNotes(legacyRemoved.notes);
  }

  await writeNotes(removed.notes);
  await rm(path.join(mediaDirectory, noteId), { recursive: true, force: true });

  return {
    notes: removed.notes,
    deletedId: noteId,
    lastImportedAt: getLastImportedAt(removed.notes),
  };
}

function queueMutation(callback) {
  const result = mutationQueue.then(callback);
  mutationQueue = result.catch(() => undefined);
  return result;
}

function queueNoteImport(body) {
  return queueMutation(() => importNote(body));
}

function queueNoteDelete(noteId) {
  return queueMutation(() => deleteNote(noteId));
}

async function sendMediaFile(request, response, pathname) {
  // XHS note IDs are typically 22-26 hex chars (varies by generation)
  const match = pathname.match(/^\/media\/([0-9a-f]{20,26})\/((?:\d{2}\.(?:avif|gif|heic|heif|jpg|png|webp))|video\.mp4)$/i);
  if (!match) return false;

  const filePath = path.join(mediaDirectory, match[1].toLowerCase(), match[2].toLowerCase());
  try {
    const stat = await fsStat(filePath);
    const contentType = mediaContentTypes.get(path.extname(filePath)) || 'application/octet-stream';
    const rangeHeader = request.headers.range;
    applyCorsHeaders(request, response);

    if (rangeHeader) {
      const matchRange = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      const start = matchRange?.[1] ? Number.parseInt(matchRange[1], 10) : 0;
      const end = matchRange?.[2] ? Number.parseInt(matchRange[2], 10) : stat.size - 1;
      if (start >= stat.size || start > end) {
        response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        response.end();
        return true;
      }
      response.writeHead(206, {
        'Content-Type': contentType,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=31536000, immutable',
      });
      createReadStream(filePath, { start, end }).pipe(response);
      return true;
    }

    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=31536000, immutable',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(request, response, 404, { ok: false, error: 'Media not found' });
  }
  return true;
}

const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendJson(request, response, 400, { ok: false, error: 'Invalid request' });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);

  // The extension content script heartbeats from the page context, so its
  // Origin is the XHS site — allow that single benign endpoint through
  // while keeping every other route on the strict allowlist.
  const isHeartbeat = request.method === 'POST' && url.pathname === '/setup/extension/heartbeat';
  if (!isHeartbeat && !isAllowedOrigin(request.headers.origin)) {
    sendJson(request, response, 403, { ok: false, error: 'Origin not allowed' });
    return;
  }
  if (isHeartbeat && request.headers.origin && !isAllowedOrigin(request.headers.origin)) {
    const host = String(request.headers.origin || '');
    if (!/xiaohongshu\.com$/i.test(host)) {
      sendJson(request, response, 403, { ok: false, error: 'Origin not allowed' });
      return;
    }
  }

  if (request.method === 'OPTIONS') {
    applyCorsHeaders(request, response);
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(request, response, 200, {
        ok: true,
        port: PORT,
        platform: process.platform,
        dataDirectory,
        localOcr: ocrStatus.available,
        ocr: ocrStatus,
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/setup') {
      sendJson(request, response, 200, await buildSetupResponse());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/setup/extension/heartbeat') {
      extensionLastSeen = Date.now();
      persistExtensionLastSeen().catch(() => {});
      sendJson(request, response, 200, { ok: true });
      return;
    }

        if (request.method === 'POST' && url.pathname === '/setup/browser-extension/open') {
      const extensionDirectory = resolveExtensionDirectory();
      if (!extensionDirectory) throw new Error('浏览器插件文件不存在');
      const body = await readRequestBody(request);
      const browser = body?.browser === 'chrome' || body?.browser === 'edge' ? body.browser : 'auto';
      platform.openFolder(extensionDirectory);
      const extensionsUrl = browser === 'edge' ? 'edge://extensions/' : 'chrome://extensions/';
      const opened = platform.openBrowserUrl(extensionsUrl, browser);
      if (!opened) throw new Error('没有找到目标浏览器，请手动打开扩展页');
      sendJson(request, response, 200, {
        ok: true,
        browser,
        path: extensionDirectory,
        message: '已打开扩展页和插件文件夹',
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/setup/agent/connect') {
      const body = await readRequestBody(request);
      sendJson(request, response, 200, await connectAgentClient(body.client));
      return;
    }

    if (request.method === 'GET' && await sendMediaFile(request, response, url.pathname)) {
      return;
    }

    if (request.method === 'GET' && url.pathname === '/notes') {
      sendJson(request, response, 200, await buildNotesResponse());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/notes/import') {
      sendJson(request, response, 200, await queueNoteImport(await readRequestBody(request)));
      return;
    }

    const deleteNoteMatch = url.pathname.match(/^\/notes\/([0-9a-f]{24})$/i);
    if (request.method === 'DELETE' && deleteNoteMatch) {
      const result = await queueNoteDelete(deleteNoteMatch[1].toLowerCase());
      if (!result) {
        sendJson(request, response, 404, { ok: false, error: '笔记不存在或已被删除' });
        return;
      }
      sendJson(request, response, 200, result);
      return;
    }

    sendJson(request, response, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    sendJson(request, response, 400, {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

async function listenWithRetry() {
  const MAX_ATTEMPTS = 10;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await new Promise((resolve, reject) => {
        const serverHandle = server.listen(PORT, '127.0.0.1');
        serverHandle.once('listening', resolve);
        serverHandle.once('error', reject);
      });
      return;
    } catch (error) {
      const code = error?.code || '';
      if (code === 'EADDRINUSE' && attempt < MAX_ATTEMPTS) {
        // A previous instance's socket may linger briefly (e.g. after a
        // force-kill). Wait and retry before declaring failure.
        console.log(`port ${PORT} busy (attempt ${attempt}/${MAX_ATTEMPTS}), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}

async function startServer() {
  probeConnectedAgents(true).catch(() => {});
  await ensureDataDirectory();
  await loadExtensionLastSeen();
  const probe = await probeLocalOcr();
  if (probe.engine) {
    ocrStatus = {
      engine: probe.engine,
      available: probe.available,
      languages: probe.languages,
      error: probe.error,
    };
    console.log(`${probe.engine} OCR: ${ocrStatus.available ? `available (${ocrStatus.languages.join(', ')})` : 'unavailable'}`);
  }
  const existingNotes = await readNotes();
  const recovered = await recoverCachedNoteCovers(existingNotes, {
    cacheDirectories: coverCacheDirectories,
    mediaDirectory,
    publicBaseUrl,
  });
  if (recovered.recoveredCount > 0) await writeNotes(recovered.notes);

  await listenWithRetry();
  console.log(`local-api listening on http://127.0.0.1:${PORT}`);
  console.log(`local data directory: ${dataDirectory}`);
  if (recovered.recoveredCount > 0) {
    console.log(`recovered ${recovered.recoveredCount} cached note covers`);
  }
}

startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
