'use client';

import { DotRow } from '../ui';
import { ImportStep } from './ImportPipeline.types';

const STEPS: Array<{ id: ImportStep; label: string }> = [
  { id: 'capture', label: 'CAPTURE' },
  { id: 'resolve', label: 'RESOLVE' },
  { id: 'media', label: 'MEDIA' },
  { id: 'ocr', label: 'OCR' },
  { id: 'index', label: 'INDEX' },
];

const STEP_INDEX: Record<ImportStep, number> = {
  capture: 0,
  resolve: 1,
  media: 2,
  ocr: 3,
  index: 4,
};

/** Five-step dot pipeline — dots light up as the import progresses. */
export function ImportPipeline({ step }: { step: ImportStep | 'idle' | 'error' }) {
  if (step === 'idle') return null;
  const activeCount = step === 'error' ? 0 : STEP_INDEX[step] + 1;
  const errored = step === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        borderRadius: 'var(--radius-6)',
        border: `1px solid ${errored ? 'var(--accent)' : 'var(--line-strong)'}`,
        background: 'var(--surface)',
      }}
    >
      {STEPS.map((s, i) => {
        const done = !errored && i < activeCount;
        const current = !errored && i === activeCount - 1;
        return (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <DotRow count={3} activeCount={done ? 3 : 0} pulse={current} color={errored ? 'var(--accent)' : 'var(--success)'} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.14em',
                color: done ? 'var(--text)' : current ? 'var(--text-dim)' : 'var(--text-faint)',
              }}
            >
              {String(i + 1).padStart(2, '0')} {s.label}
            </span>
          </span>
        );
      })}
      {errored && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--accent)' }}>
          FAILED
        </span>
      )}
    </div>
  );
}
