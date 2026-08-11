const PAGE_HOSTS = new Set([
  'xiaohongshu.com',
  'www.xiaohongshu.com',
  'm.xiaohongshu.com',
]);
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 5 * 1024 * 1024;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstString(object, keys) {
  for (const key of keys) {
    const value = cleanString(object?.[key]);
    if (value) return value;
  }
  return '';
}

function assertAllowedPageUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !PAGE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('匿名解析器只允许访问小红书笔记页面');
  }
  return url;
}

function imageUrlFromItem(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';

  const direct = firstString(item, ['urlDefault', 'urlPre', 'url', 'originUrl']);
  if (/^https?:\/\//i.test(direct)) return direct.replace(/^http:/i, 'https:');

  for (const listKey of ['urlList', 'infoList', 'stream']) {
    const list = item[listKey];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const nested = imageUrlFromItem(entry);
      if (nested) return nested;
    }
  }
  return '';
}

function imageUrlsFromNote(note) {
  const urls = [];
  for (const key of ['imageList', 'images', 'image_list']) {
    const list = note?.[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const url = imageUrlFromItem(item);
      if (url) urls.push(url);
    }
  }

  for (const candidate of [note?.cover, note?.video?.cover, note?.video?.firstFrame]) {
    const url = imageUrlFromItem(candidate);
    if (url) urls.push(url);
  }
  return Array.from(new Set(urls)).slice(0, 20);
}

function looksLikeNote(value, noteId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidateId = firstString(value, ['noteId', 'note_id', 'id']).toLowerCase();
  if (candidateId !== noteId.toLowerCase()) return false;
  return Boolean(
    firstString(value, ['title', 'displayTitle', 'desc', 'description', 'content'])
    || imageUrlsFromNote(value).length,
  );
}

function findNote(root, noteId) {
  if (!root || typeof root !== 'object') return null;
  const directCandidates = [
    root?.noteDetailMap?.[noteId]?.note,
    root?.noteDetailMap?.[noteId],
    root?.noteData?.data?.noteData,
    root?.noteData?.note,
  ];
  const direct = directCandidates.find((value) => looksLikeNote(value, noteId));
  if (direct) return direct;

  const queue = [{ value: root, depth: 0 }];
  const visited = new WeakSet();
  let inspected = 0;
  while (queue.length && inspected < 20_000) {
    const { value, depth } = queue.shift();
    if (!value || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    inspected += 1;
    if (looksLikeNote(value, noteId)) return value;
    if (depth >= 8) continue;

    let entries;
    try {
      entries = Array.isArray(value) ? value : Object.values(value);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry && typeof entry === 'object') queue.push({ value: entry, depth: depth + 1 });
    }
  }
  return null;
}

function extractInitialState(html) {
  const marker = 'window.__INITIAL_STATE__=';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const valueStart = start + marker.length;
  const valueEnd = html.indexOf('</script>', valueStart);
  if (valueEnd === -1) return null;
  const serialized = html.slice(valueStart, valueEnd).trim().replace(/;$/, '');

  try {
    return JSON.parse(serialized);
  } catch {
    try {
      return JSON.parse(serialized.replace(/\bundefined\b/g, 'null'));
    } catch {
      return null;
    }
  }
}

function tagsFromNote(note) {
  const tags = [];
  for (const key of ['tagList', 'tags', 'topicList']) {
    const values = note?.[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      const tag = typeof value === 'string'
        ? value
        : firstString(value, ['name', 'title', 'tagName', 'topicName']);
      if (tag) tags.push(tag.replace(/^#/, ''));
    }
  }
  return Array.from(new Set(tags)).slice(0, 20);
}

function notePayloadFromHtml(html, noteId, sourceUrl) {
  const state = extractInitialState(html);
  const noteRoot = state?.note || state?.noteData || null;
  const note = findNote(noteRoot, noteId);
  if (!note) {
    throw new Error('匿名解析没有读到完整笔记；不会切换到你的登录浏览器');
  }

  const user = note.user || note.author || {};
  const imageUrls = imageUrlsFromNote(note);
  const title = firstString(note, ['title', 'displayTitle']);
  const content = firstString(note, ['desc', 'description', 'content']);
  if (!title && !content && imageUrls.length === 0) {
    throw new Error('匿名解析返回的笔记内容为空');
  }

  return {
    id: noteId,
    sourceUrl,
    title,
    content,
    imageUrls,
    coverUrl: imageUrls[0] || '',
    author: {
      name: firstString(user, ['nickname', 'name', 'nickName']),
      avatar: firstString(user, ['avatar', 'image']),
      userId: firstString(user, ['userId', 'user_id', 'id']),
    },
    tags: tagsFromNote(note),
    type: note.type === 'video' || note.video ? 'video' : 'normal',
  };
}

async function fetchAnonymousPage(sourceUrl, fetchImpl) {
  let currentUrl = assertAllowedPageUrl(sourceUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchImpl(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'User-Agent': 'KanKanFavorites/0.1 anonymous-local-resolver',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount >= MAX_REDIRECTS) throw new Error('匿名解析重定向次数过多');
      const location = response.headers.get('location');
      if (!location) throw new Error('匿名解析重定向缺少目标地址');
      currentUrl = assertAllowedPageUrl(new URL(location, currentUrl).toString());
      continue;
    }
    if (!response.ok) throw new Error(`匿名解析请求失败：${response.status}`);

    const declaredLength = Number.parseInt(response.headers.get('content-length') || '0', 10);
    if (declaredLength > MAX_HTML_BYTES) throw new Error('匿名解析页面过大');
    const html = await response.text();
    if (Buffer.byteLength(html) > MAX_HTML_BYTES) throw new Error('匿名解析页面过大');
    return html;
  }

  throw new Error('匿名解析失败');
}

export async function resolveAnonymousNote(sourceUrl, options = {}) {
  const pageUrl = assertAllowedPageUrl(sourceUrl);
  const noteId = options.expectedNoteId || pageUrl.pathname
    .match(/^\/(?:explore|search_result|discovery\/item)\/([0-9a-f]{24})(?:\/|$)/i)?.[1];
  if (!noteId || !/^[0-9a-f]{24}$/i.test(noteId)) {
    throw new Error('匿名解析器没有识别到笔记 ID');
  }

  const html = await fetchAnonymousPage(pageUrl.toString(), options.fetchImpl || fetch);
  return notePayloadFromHtml(html, noteId.toLowerCase(), pageUrl.toString());
}
