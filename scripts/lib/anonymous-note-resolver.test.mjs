import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAnonymousNote } from './anonymous-note-resolver.mjs';

const noteId = '64cb12340000000001020304';
const sourceUrl = `https://www.xiaohongshu.com/search_result/${noteId}?xsec_token=temporary-token`;

function buildHtml() {
  const state = {
    note: {
      noteDetailMap: {
        [noteId]: {
          note: {
            noteId,
            title: '匿名解析标题',
            desc: '匿名解析正文',
            imageList: [
              { urlDefault: 'https://sns-webpic-qc.xhscdn.com/first.webp' },
              { urlList: ['https://sns-webpic-qc.xhscdn.com/second.webp'] },
            ],
            user: {
              nickname: '作者',
              userId: 'author-id',
            },
            tagList: [{ name: '设计' }],
          },
        },
      },
    },
  };
  return `<html><script>window.__INITIAL_STATE__=${JSON.stringify(state)}</script></html>`;
}

test('anonymous resolver keeps the dragged token but never sends account credentials', async () => {
  let requestedUrl = '';
  let requestInit;
  const note = await resolveAnonymousNote(sourceUrl, {
    expectedNoteId: noteId,
    fetchImpl: async (url, init) => {
      requestedUrl = url.toString();
      requestInit = init;
      return new Response(buildHtml(), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    },
  });

  assert.equal(requestedUrl, sourceUrl);
  assert.equal(requestInit.credentials, 'omit');
  assert.doesNotThrow(() => new Headers(requestInit.headers));
  assert.equal(
    Object.keys(requestInit.headers).some((name) => name.toLowerCase() === 'cookie'),
    false,
  );
  assert.equal(note.title, '匿名解析标题');
  assert.equal(note.content, '匿名解析正文');
  assert.deepEqual(note.imageUrls, [
    'https://sns-webpic-qc.xhscdn.com/first.webp',
    'https://sns-webpic-qc.xhscdn.com/second.webp',
  ]);
  assert.deepEqual(note.tags, ['设计']);
});

test('anonymous resolver refuses to leave the Xiaohongshu page origin on redirect', async () => {
  await assert.rejects(
    resolveAnonymousNote(sourceUrl, {
      expectedNoteId: noteId,
      fetchImpl: async () => new Response('', {
        status: 302,
        headers: { Location: 'https://example.com/collect-account' },
      }),
    }),
    /只允许访问小红书笔记页面/,
  );
});

test('anonymous resolver fails closed instead of falling back to a logged-in browser', async () => {
  await assert.rejects(
    resolveAnonymousNote(sourceUrl, {
      expectedNoteId: noteId,
      fetchImpl: async () => new Response('<html><h1>无法浏览</h1></html>', { status: 200 }),
    }),
    /不会切换到你的登录浏览器/,
  );
});
