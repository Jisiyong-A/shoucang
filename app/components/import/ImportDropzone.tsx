'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { DotMatrix } from '../ui';
import { ImportPipeline } from './ImportPipeline';
import { ImportStep } from './ImportPipeline.types';

export type ImportFeedback = {
  phase: 'idle' | 'dragging' | 'recognized' | 'processing' | 'complete' | 'error';
  step: ImportStep | 'idle' | 'error';
  title: string;
  message: string;
};

export const IDLE_IMPORT_FEEDBACK: ImportFeedback = {
  phase: 'idle',
  step: 'idle',
  title: '',
  message: '',
};

/** Full-screen dropzone + import pipeline overlay. */
export function ImportDropzone({
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
          zIndex: 'var(--z-dropzone)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          background: dragging ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.72)',
          backdropFilter: dragging ? 'blur(4px)' : 'blur(10px)',
          WebkitBackdropFilter: dragging ? 'blur(4px)' : 'blur(10px)',
          pointerEvents: dragging ? 'auto' : 'none',
        }}
      >
        {dragging ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: [1, 1.03, 1] }}
            transition={{ opacity: { duration: 0.15 }, scale: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
          >
            <DotMatrix
              size="dense"
              color="var(--accent)"
              style={{
                width: 96,
                height: 96,
                borderRadius: 'var(--radius-6)',
                border: '2px dashed var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.24em', color: 'var(--text)' }}>
              松手收录
            </span>
          </motion.div>
        ) : (
          <>
            <ImportPipeline step={feedback.step} />
            <motion.div
              layout
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              style={{
                minWidth: 320,
                maxWidth: 520,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '15px 18px',
                borderRadius: 'var(--radius-6)',
                background: 'var(--surface)',
                border: feedback.phase === 'error' ? '1px solid var(--accent)' : 'var(--border-strong)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: feedback.phase === 'error' ? 'var(--accent)' : 'var(--text)',
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
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
