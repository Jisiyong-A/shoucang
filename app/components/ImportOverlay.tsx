'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';
import { ImportFeedback } from './DeskView.types';

export function ImportOverlay({
  feedback,
  draggedNoteId,
  onDrop,
}: {
  feedback: ImportFeedback;
  draggedNoteId: string | null;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}) {
  const active = feedback.phase !== 'idle' && !draggedNoteId;
  if (!active) return null;

  const dragging = feedback.phase === 'dragging';
  const processing = feedback.phase === 'processing';
  const error = feedback.phase === 'error';
  const success = feedback.phase === 'complete' || feedback.phase === 'recognized';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: dragging ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.72)',
          backdropFilter: dragging ? 'blur(4px)' : 'blur(10px)',
          WebkitBackdropFilter: dragging ? 'blur(4px)' : 'blur(10px)',
          pointerEvents: dragging ? 'auto' : 'none',
        }}
      >
        {dragging ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: [1, 1.04, 1] }}
            transition={{ opacity: { duration: 0.15 }, scale: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              className="dot-field-fine"
              style={{
                width: 96,
                height: 96,
                borderRadius: 14,
                border: '2px dashed var(--signal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--signal)',
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.24em', color: 'var(--text)' }}>
              松手收录
            </span>
          </motion.div>
        ) : (
          <motion.div
            layout
            initial={{ scale: 0.95, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              minWidth: 320,
              maxWidth: 520,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '15px 18px',
              borderRadius: 12,
              background: '#0C0C0E',
              border: `1px solid ${error ? 'var(--signal)' : success ? 'var(--ok)' : 'var(--line-strong)'}`,
            }}
          >
            <motion.div
              animate={processing ? { rotate: 360 } : { rotate: 0 }}
              transition={processing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
              style={{
                width: 38,
                height: 38,
                flexShrink: 0,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: error ? 'var(--signal-soft)' : success ? 'var(--ok-soft)' : 'var(--surface-3)',
                color: error ? 'var(--signal)' : success ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {processing ? <Loader2 size={18} />
                : success ? <Check size={18} strokeWidth={2.2} />
                  : <X size={18} strokeWidth={2.2} />}
            </motion.div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {feedback.title}
              </div>
              {feedback.message && (
                <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--text-dim)' }}>
                  {feedback.message}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
