'use client';

import { motion } from 'framer-motion';
import { Note } from '../../types/xiaohongshu';
import { formatDate } from '../../lib/xhs-client';
import { Badge } from '../ui';
import { MatchSource, SearchResultMeta } from '../search/SearchResultMeta';

export function NoteCard({
  note,
  index,
  dimmed,
  matchSources,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  note: Note;
  index: number;
  dimmed?: boolean;
  matchSources?: MatchSource[];
  onClick: () => void;
  onDragStart?: (noteId: string) => void;
  onDragEnd?: () => void;
}) {
  const hasOcr = Boolean((note.ocrText || '').trim());
  const imageCount = (note.imageUrls || []).length || (note.coverUrl ? 1 : 0);
  const mediaReady = note.mediaStatus !== 'pending' && note.mediaStatus !== 'none';
  const category = note.category === 'inbox' ? 'INBOX' : note.category.toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dimmed ? 0.3 : 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      whileHover={dimmed ? undefined : { y: -3 }}
      whileTap={dimmed ? undefined : { scale: 0.98 }}
      onClick={dimmed ? undefined : onClick}
      draggable={!dimmed}
      onDragStart={() => onDragStart?.(note.id)}
      onDragEnd={() => onDragEnd?.()}
      role="button"
      tabIndex={0}
      aria-label={`${note.title}，${category}`}
      onKeyDown={(e) => {
        if (!dimmed && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        cursor: dimmed ? 'default' : 'pointer',
        pointerEvents: dimmed ? 'none' : 'auto',
        userSelect: 'none',
        background: 'var(--surface)',
        border: 'var(--border-hairline)',
        borderRadius: 'var(--radius-4)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
        transition: 'border-color var(--motion-fast) var(--ease-out)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
    >
      {/* Image — geometric zone */}
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#0A0A0C', overflow: 'hidden' }}>
        {note.coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={note.coverUrl}
            alt={note.title}
            draggable={false}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = '0';
            }}
          />
        ) : (
          <div
            className="pixel-block"
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{ fontFamily: 'var(--font-dot)', fontSize: 34, color: 'var(--text-faint)' }}>
              {note.title.slice(0, 1) || '#'}
            </span>
          </div>
        )}
        {/* Type / media badges */}
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
          {note.type === 'video' && <Badge>VIDEO</Badge>}
          {!mediaReady && <Badge tone="signal">MEDIA?</Badge>}
        </div>
      </div>

      {/* Meta — geometry partition */}
      <div style={{ padding: '10px 12px 11px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span
            style={{
              fontFamily: 'var(--font-dot)',
              fontSize: 16,
              color: 'var(--text-faint)',
              letterSpacing: '0.04em',
            }}
          >
            {String(index + 1).padStart(2, '0')} /
          </span>
          <Badge tone={note.category === 'inbox' ? 'signal' : 'default'}>{category}</Badge>
          {hasOcr && <Badge tone="ok">OCR</Badge>}
        </div>

        <p
          className="line-clamp-2"
          style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: 'var(--text)' }}
        >
          {note.title}
        </p>

        {matchSources && matchSources.length > 0 && <SearchResultMeta sources={matchSources} />}

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingTop: 2,
            borderTop: 'var(--border-hairline)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-faint)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {note.author?.name || '—'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {hasOcr && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)' }}>
                OCR • {imageCount} IMAGES
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
              {formatDate(note.savedAt)}
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
