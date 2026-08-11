const DRAG_PAYLOAD_PREFIX = 'KANKAN_NOTE:';
const CARD_DRAG_PAYLOAD_PREFIX = 'KANKAN_CARD:';
const SUPPORTED_DRAG_TYPES = new Set([
  'application/x-kankan-note',
  'application/x-kankan-card',
  'text/plain',
  'text/uri-list',
  'text/x-moz-url',
]);

export function acceptsExternalNoteDrag(types) {
  const normalizedTypes = Array.from(types || [], (type) => String(type).toLowerCase());
  return normalizedTypes.length === 0
    || normalizedTypes.some((type) => SUPPORTED_DRAG_TYPES.has(type));
}

function firstUri(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#')) || '';
}

export function selectDraggedNoteInput({ custom = '', plain = '', uriList = '', mozUrl = '' } = {}) {
  const values = [custom, plain].map((value) => String(value || '').trim());
  for (const prefix of [DRAG_PAYLOAD_PREFIX, CARD_DRAG_PAYLOAD_PREFIX]) {
    const payload = values.find((value) => value.includes(prefix));
    if (payload) return payload.slice(payload.indexOf(prefix));
  }

  return firstUri(uriList) || firstUri(mozUrl) || values.find(Boolean) || '';
}

export function parseDraggedCardInput(value) {
  const input = String(value || '');
  const markerIndex = input.indexOf(CARD_DRAG_PAYLOAD_PREFIX);

  try {
    const payload = markerIndex >= 0
      ? JSON.parse(input.slice(markerIndex + CARD_DRAG_PAYLOAD_PREFIX.length))
      : { sourceUrl: firstUri(input), title: '' };
    const sourceUrl = new URL(payload?.sourceUrl || '');
    const id = markerIndex >= 0
      ? payload?.id
      : sourceUrl.pathname.match(/^\/(?:explore|search_result|discovery\/item)\/([0-9a-f]{24})(?:\/|$)/i)?.[1];
    if (!/^[0-9a-f]{24}$/i.test(id || '')) return null;
    if (!['www.xiaohongshu.com', 'm.xiaohongshu.com'].includes(sourceUrl.hostname)) return null;
    return {
      id: id.toLowerCase(),
      sourceUrl: sourceUrl.toString(),
      title: typeof payload.title === 'string' ? payload.title.trim().slice(0, 100) : '',
    };
  } catch {
    return null;
  }
}
