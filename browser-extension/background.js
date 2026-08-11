const LOCAL_IMPORT_URL = 'http://127.0.0.1:4318/notes/import';

async function importNote(note) {
  const response = await fetch(LOCAL_IMPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '本地导入失败');
  return payload;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'IMPORT_NOTE') {
    importNote(message.note)
      .then((payload) => sendResponse({ ok: true, created: payload.created !== false }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : '无法连接看看收藏',
        });
      });
    return true;
  }

  return false;
});
