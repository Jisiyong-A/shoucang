/**
 * AI classification for imported notes.
 *
 * Privacy & failure model:
 * - The API key is read from the local environment only (env var first,
 *   then the Hermes .env file) and is never stored by the app.
 * - Classification is async and best-effort: any failure falls back to
 *   the rule-based classifier already in place — importing never blocks
 *   on the AI.
 * - Only the note's own text (title/body/OCR) is sent; nothing else.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export const AI_CLASSIFY_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
export const AI_CLASSIFY_MODEL = 'deepseek-v4-flash';

export const CATEGORY_OPTIONS = [
  '空间美学', '咖啡科学', 'AI工具', '植物', '美食餐饮',
  '旅行户外', '生活方式', '阅读思考', '设计美学', '编程开发',
  '健康运动', '影视音乐', '摄影', '其他',
];

const DEFAULT_ENV_FILES = [
  process.env.LOCAL_AI_ENV_FILE || '',
  'D:/hermes/.env',
].filter(Boolean);

export async function loadAiApiKey(env = process.env) {
  if (env.OPENCODE_GO_API_KEY && String(env.OPENCODE_GO_API_KEY).trim()) {
    return String(env.OPENCODE_GO_API_KEY).trim();
  }
  for (const file of DEFAULT_ENV_FILES) {
    try {
      if (!existsSync(file)) continue;
      const text = await readFile(file, 'utf8');
      const match = text.match(/^OPENCODE_GO_API_KEY\s*=\s*(.+)$/m);
      if (match) {
        const value = match[1].trim().replace(/^["']|["']$/g, '');
        if (value) return value;
      }
    } catch {
      // try the next file
    }
  }
  return null;
}

function buildPrompt(note) {
  const body = String(note.rawContent || note.content || '').trim().slice(0, 1200);
  const ocr = String(note.ocrText || '').trim().slice(0, 600);
  return [
    '你是「收藏」应用的笔记分类助手。根据笔记内容把它归入下面分类之一（只输出一个分类名，不要解释、不要标点）：',
    CATEGORY_OPTIONS.join('、'),
    `标题：${String(note.title || '').slice(0, 120)}`,
    body ? `正文：${body}` : '',
    ocr ? `图片文字：${ocr}` : '',
  ].filter(Boolean).join('\n');
}

export function normalizeCategory(raw) {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/[。，,.、\s"'']/g, '');
  const exact = CATEGORY_OPTIONS.find((option) => cleaned === option || cleaned.includes(option));
  if (exact) return exact;
  // fuzzy: longest shared substring wins
  let best = null;
  let bestLen = 0;
  for (const option of CATEGORY_OPTIONS) {
    if (cleaned.includes(option) && option.length > bestLen) {
      best = option;
      bestLen = option.length;
    }
  }
  return best;
}

export async function classifyWithAI(note, options = {}) {
  const apiKey = options.apiKey !== undefined
    ? options.apiKey
    : (await loadAiApiKey(options.env));
  if (!apiKey) return { ok: false, category: null, reason: 'no-api-key' };

  const url = options.baseUrl || AI_CLASSIFY_URL;
  const model = options.model || AI_CLASSIFY_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 12_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a concise note classifier. Output ONLY the category name.' },
          { role: 'user', content: buildPrompt(note) },
        ],
        temperature: 0.1,
        max_tokens: 32,
      }),
    });

    if (!response.ok) {
      return { ok: false, category: null, reason: `http-${response.status}` };
    }
    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content || '';
    const category = normalizeCategory(raw);
    return category
      ? { ok: true, category }
      : { ok: false, category: null, reason: 'unparseable' };
  } catch {
    return { ok: false, category: null, reason: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
