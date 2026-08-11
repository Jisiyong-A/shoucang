'use client';

import { motion } from 'framer-motion';
import { Note } from '../types/xiaohongshu';
import { formatDate } from '../lib/xhs-client';
import { SquareTag } from './ui';

export function NoteCard({
  note,
  dimmed,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  note: Note;
  dimmed?: boolean;
  onClick: () => void;
  onDragStart?: (noteId: string) => void;
  onDragEnd?: () => void;
}) {
  const hasOcr = Boolean((note.ocrText || '').trim());
  const mediaReady = note.mediaStatus !== 'pending' && note.mediaStatus !== 'none';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dimmed ? 0.3 : 1, y: 0 }}
      transition={{ duration: 0.22 }}
      whileHover={dimmed ? undefined : { y: -3 }}
      whileTap={dimmed ? undefined : { scale: 0.98 }}
      onClick={dimmed ? undefined : onClick}
      draggable={!dimmed}
      onDragStart={() => onDragStart?.(note.id)}
      onDragEnd={() => onDragEnd?.()}
      style={{
        cursor: dimmed ? 'default' : 'pointer',
        pointerEvents: dimmed ? 'none' : 'auto',
        userSelect: 'none',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
    >
      {/* Cover */}
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--text-faint)' }}>
              {note.title.slice(0, 1) || '#'}
            </span>
          </div>
        )}

        {/* Type badge */}
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
          {note.type === 'video' && <SquareTag tone="default">VIDEO</SquareTag>}
          {!mediaReady && <SquareTag tone="signal">MEDIA?</SquareTag>}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px 11px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SquareTag tone={note.category === 'inbox' ? 'signal' : 'default'}>{note.category}</SquareTag>
          {hasOcr && <SquareTag tone="ok">OCR</SquareTag>}
        </div>

        <p
          className="line-clamp-2"
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.5,
            color: 'var(--text)',
          }}
        >
          {note.title}
        </p>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingTop: 2,
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
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-faint)',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            {formatDate(note.savedAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
