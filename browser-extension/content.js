const BUTTON_ID = 'shoucang-note-import-button';
const PAYLOAD_PREFIX = 'SHOUCANG_NOTE:';
const CARD_PAYLOAD_PREFIX = 'SHOUCANG_CARD:';
const PAGE_DATA_SOURCE = 'shoucang-note-page-data';
const PAGE_DATA_REQUEST_EVENT = 'shoucang-note-capture-request';
let cachedPageData = null;
let requestedNoteId = '';

function getNoteId() {
  // XHS note IDs are typically 22-26 hex chars (varies by generation)
  return location.pathname.match(/^\/(?:explore|search_result|discovery\/item)\/([0-9a-f]{20,26})(?:\/|$)/i)?.[1] || '';
}

function noteCardFromDragTarget(target) {
  if (!(target instanceof Element) || target.closest(`#${BUTTON_ID}`)) return null;
  const link = target.closest('a[href*="/explore/"], a[href*="/search_result/"], a[href*="/discovery/item/"]');
  if (!link) return null;

  try {
    const sourceUrl = new URL(link.getAttribute('href'), location.href);
    if (!['www.xiaohongshu.com', 'm.xiaohongshu.com'].includes(sourceUrl.hostname)) return null;
    const id = sourceUrl.pathname.match(/^\/(?:explore|search_result|discovery\/item)\/([0-9a-f]{24})(?:\/|$)/i)?.[1];
    if (!id) return null;

    const card = link.closest('section, [class*="note-item"], [class*="feed-item"], [class*="note-card"]')
      || link.parentElement?.parentElement?.parentElement;
    const title = card?.querySelector('[class*="title"]')?.textContent?.trim()
      || (link.textContent || '').trim()
      || '这条笔记';

    return { id, sourceUrl: sourceUrl.toString(), title };
  } catch {
    return null;
  }
}

function firstText(selectors) {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return '';
}

function metaContent(property) {
  return document.querySelector(`meta[property="${property}"]`)?.content?.trim()
    || document.querySelector(`meta[name="${property}"]`)?.content?.trim()
    || '';
}

function bestSrcsetUrl(value) {
  if (typeof value !== 'string') return '';
  const candidates = value.split(',').map((candidate) => {
    const [url, descriptor = '0w'] = candidate.trim().split(/\s+/);
    return { url, size: Number.parseFloat(descriptor) || 0 };
  });
  return candidates.sort((a, b) => b.size - a.size)[0]?.url || '';
}

function imageUrlFromElement(image) {
  return bestSrcsetUrl(image.getAttribute('srcset'))
    || bestSrcsetUrl(image.parentElement?.querySelector('source')?.getAttribute('srcset'))
    || image.currentSrc
    || image.getAttribute('data-src')
    || image.src
    || '';
}

function isNoteImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname.endsWith('.xhscdn.com') || url.hostname.endsWith('.xhsimg.com'));
  } catch {
    return false;
  }
}

function normalizeNoteImageUrl(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/^http:/i, 'https:');
  return isNoteImageUrl(normalized) ? normalized : '';
}

function collectImages() {
  const urls = new Set(
    Array.isArray(cachedPageData?.imageUrls)
      ? cachedPageData.imageUrls.map(normalizeNoteImageUrl).filter(Boolean)
      : [],
  );
  const metaImage = metaContent('og:image');
  const normalizedMetaImage = normalizeNoteImageUrl(metaImage);
  if (normalizedMetaImage) urls.add(normalizedMetaImage);

  document.querySelectorAll('.note-content img, .swiper-slide img, [class*="note-content"] img, [class*="carousel"] img').forEach((image) => {
    const url = normalizeNoteImageUrl(imageUrlFromElement(image));
    if (url) urls.add(url);
  });

  return Array.from(urls).slice(0, 20);
}

function collectTags() {
  const tags = new Set();
  document.querySelectorAll('#detail-desc a, .desc a, [class*="desc"] a').forEach((node) => {
    const value = node.textContent?.trim().replace(/^#/, '');
    if (value && value.length <= 40) tags.add(value);
  });
  return Array.from(tags).slice(0, 20);
}

function captureCurrentNote() {
  const id = getNoteId();
  if (!id) throw new Error('请先打开一条小红书笔记详情');

  const title = cachedPageData?.title
    || firstText(['#detail-title', '.note-content .title', '[class*="note"] [class*="title"]'])
    || metaContent('og:title').replace(/\s*[-|_].*小红书.*$/i, '')
    || document.title.replace(/\s*[-|_].*小红书.*$/i, '');
  const content = cachedPageData?.content
    || firstText(['#detail-desc', '.note-content .desc', '[class*="note"] [class*="desc"]'])
    || metaContent('description')
    || metaContent('og:description');
  const imageUrls = collectImages();
  const videoUrl = cachedPageData?.videoUrl
    || (() => {
      try {
        const video = document.querySelector('video');
        if (video?.src && /^https?:\/\//.test(video.src)) return video.src;
        const source = document.querySelector('video source[src]');
        if (source?.src && /^https?:\/\//.test(source.src)) return source.src;
        // XHS plays video via MSE (blob: src) — the real signed stream
        // URL lives in one of the page's script payloads on the
        // sns-video-*.xhscdn.com CDN (e.g. _259.mp4/_301.mp4 = quality
        // tiers; pick the largest). Regex-scan ALL scripts.
        const pattern = /https?:\/\/sns-video[a-z0-9-]*\.xhscdn\.com[^"'\\\s)]*\.mp4[^"'\\\s)]*/g;
        const found = [];
        for (const el of document.querySelectorAll('script')) {
          const text = el.textContent;
          if (text.includes('sns-video')) {
            const matches = text.match(pattern) || [];
            found.push(...matches);
          }
        }
        if (found.length > 0) {
          // pick the highest quality tier by the _NNN.mp4 marker
          const tier = (url) => Number.parseInt(url.match(/_(\d{2,4})\.mp4/)?.[1] || '0', 10);
          return found.sort((a, b) => tier(b) - tier(a))[0];
        }
      } catch {
        // no video on this page — normal image notes hit here
      }
      return '';
    })();

  return {
    id,
    sourceUrl: location.href,
    title,
    content,
    imageUrls,
    coverUrl: imageUrls[0] || '',
    videoUrl,
    author: {
      name: cachedPageData?.author?.name
        || firstText(['.author-wrapper .username', '.author-wrapper [class*="name"]', '[class*="author"] .username']),
      avatar: cachedPageData?.author?.avatar
        || document.querySelector('.author-wrapper img, [class*="author"] img')?.src
        || '',
      userId: cachedPageData?.author?.userId || '',
    },
    tags: collectTags(),
    type: document.querySelector('video') ? 'video' : 'normal',
  };
}

function setButtonState(button, label, tone) {
  button.textContent = label;
  button.style.background = tone;
}

/** Fire-and-forget heartbeat so the app can show CONNECTED status.
 *  No polling: runs once per page load + per import interaction. */
function heartbeat() {
  try {
    fetch('http://127.0.0.1:4318/setup/extension/heartbeat', {
      method: 'POST',
      credentials: 'omit',
    }).catch(() => {});
  } catch {
    // offline is fine — the button will surface it on interaction
  }
}

function installButton() {
  const existing = document.getElementById(BUTTON_ID);
  if (!getNoteId()) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.draggable = true;
  button.textContent = '拖到「收藏」';
  button.title = '拖到收藏，或点击直接收藏当前笔记';
  Object.assign(button.style, {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    zIndex: '2147483647',
    height: '42px',
    padding: '0 18px',
    border: '1px solid rgba(255,255,255,0.55)',
    borderRadius: '999px',
    background: '#829987',
    color: '#fff',
    boxShadow: '0 10px 30px rgba(42,50,44,0.28)',
    font: '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    cursor: 'grab',
  });

  button.addEventListener('dragstart', (event) => {
    try {
      const note = captureCurrentNote();
      const payload = `${PAYLOAD_PREFIX}${JSON.stringify(note)}`;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-shoucang-note', payload);
      event.dataTransfer.setData('text/plain', payload);
      event.dataTransfer.setData('text/uri-list', note.sourceUrl);
      heartbeat();
    } catch (error) {
      event.preventDefault();
      setButtonState(button, 'PAGE DATA NOT AVAILABLE', '#B56A5B');
    }
  });

  button.addEventListener('pointerenter', () => {
    document.dispatchEvent(new CustomEvent(PAGE_DATA_REQUEST_EVENT));
  });

  button.addEventListener('click', () => {
    let note;
    try {
      note = captureCurrentNote();
    } catch (error) {
      setButtonState(button, 'PAGE DATA NOT AVAILABLE', '#B56A5B');
      return;
    }

    setButtonState(button, '正在收藏…', '#9AA99D');
    heartbeat();
    chrome.runtime.sendMessage({ type: 'IMPORT_NOTE', note }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        setButtonState(button, response?.error || 'LOCAL ENGINE OFFLINE', '#B56A5B');
      } else {
        setButtonState(button, response.created ? '已收藏 ✓' : '已更新 ✓', '#6E9478');
      }
      setTimeout(() => setButtonState(button, '拖到「收藏」', '#829987'), 2200);
    });
  });

  document.documentElement.appendChild(button);
}

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  if (event.data?.source !== PAGE_DATA_SOURCE) return;
  if (event.data.payload?.id === getNoteId()) {
    cachedPageData = event.data.payload;
  }
});

document.addEventListener('dragstart', (event) => {
  if (!event.dataTransfer) return;

  // Drag from anywhere on a note DETAIL page (image, body, caption):
  // ship the full captured note instead of the browser's default payload
  // (a bare image URL would fail resolution).
  const noteId = getNoteId();
  if (noteId && !event.target.closest(`#${BUTTON_ID}`)) {
    try {
      const note = captureCurrentNote();
      const payload = `${PAYLOAD_PREFIX}${JSON.stringify(note)}`;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-shoucang-note', payload);
      event.dataTransfer.setData('text/plain', payload);
      event.dataTransfer.setData('text/uri-list', note.sourceUrl);
      heartbeat();
      return;
    } catch {
      // fall through to the card handler below (still better than nothing)
    }
  }

  // Drag from a feed/search card: minimal payload (id + token link + title);
  // the app resolves the rest anonymously.
  const card = noteCardFromDragTarget(event.target);
  if (!card) return;

  const payload = `${CARD_PAYLOAD_PREFIX}${JSON.stringify(card)}`;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('application/x-shoucang-card', payload);
  event.dataTransfer.setData('text/plain', payload);
  event.dataTransfer.setData('text/uri-list', card.sourceUrl);
  heartbeat();
}, true);

installButton();
heartbeat();
document.dispatchEvent(new CustomEvent(PAGE_DATA_REQUEST_EVENT));
setInterval(() => {
  installButton();
  const noteId = getNoteId();
  if (noteId && noteId !== requestedNoteId) {
    requestedNoteId = noteId;
    document.dispatchEvent(new CustomEvent(PAGE_DATA_REQUEST_EVENT));
  } else if (!noteId) {
    requestedNoteId = '';
    cachedPageData = null;
  }
}, 1000);
