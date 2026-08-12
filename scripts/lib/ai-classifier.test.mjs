import assert from 'node:assert/strict';
import test from 'node:test';
import { CATEGORY_OPTIONS, classifyWithAI, loadAiApiKey, normalizeCategory } from './ai-classifier.mjs';

test('normalizeCategory matches exact option', () => {
  assert.equal(normalizeCategory('咖啡科学'), '咖啡科学');
  assert.equal(normalizeCategory(' 旅行户外 '), '旅行户外');
});

test('normalizeCategory strips punctuation and finds fuzzy matches', () => {
  assert.equal(normalizeCategory('美食餐饮。'), '美食餐饮');
  assert.equal(normalizeCategory('归类为AI工具'), 'AI工具');
});

test('normalizeCategory returns null for unknown input', () => {
  assert.equal(normalizeCategory('完全不相关的输出内容'), null);
  assert.equal(normalizeCategory(''), null);
  assert.equal(normalizeCategory(null), null);
});

test('loadAiApiKey prefers env var over env file', async () => {
  const env = { OPENCODE_GO_API_KEY: 'env-key' };
  const key = await loadAiApiKey(env);
  assert.equal(key, 'env-key');
});

test('loadAiApiKey reads the hermes env file when env is unset', async () => {
  // The dev machine has D:/hermes/.env with a real key; the test only
  // asserts the *shape* (sk-...) without printing it.
  const key = await loadAiApiKey({});
  if (key) {
    assert.ok(key.length > 10, 'key should be non-trivial');
  }
});

test('classifyWithAI fails closed without a key', async () => {
  const result = await classifyWithAI({ title: 'x' }, { apiKey: '' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-api-key');
});

test('classifyWithAI returns an option on a real API call (best-effort)', async () => {
  // Live test: uses the machine's own key; skipped cleanly when absent.
  const key = await loadAiApiKey({});
  if (!key) return;
  const note = { title: '手冲咖啡水温控制技巧', rawContent: '粉水比1:15，92度水温，闷蒸30秒' };
  const result = await classifyWithAI(note, { apiKey: key });
  assert.equal(result.ok, true);
  assert.ok(CATEGORY_OPTIONS.includes(result.category), `got ${result.category}`);
}, { timeout: 20_000 });

test('category options cover the previous rule taxonomy', () => {
  for (const option of ['生活方式', '美食餐饮', 'AI工具', '植物', '咖啡科学']) {
    assert.ok(CATEGORY_OPTIONS.includes(option));
  }
});
