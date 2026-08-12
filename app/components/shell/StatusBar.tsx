'use client';

import { LocalServiceHealth } from '../../lib/xhs-client';
import { StatusLight } from '../ui';

export function StatusBar({
  health,
  noteCount,
  ocrCount,
  onOpenSetup,
}: {
  health: LocalServiceHealth;
  noteCount: number;
  ocrCount: number;
  onOpenSetup: () => void;
}) {
  const ocr = health.ocr;
  const ocrReady = Boolean(ocr?.available);
  const ocrLabel = !ocr
    ? 'OCR —'
    : ocr.engine === null
      ? 'OCR UNSUPPORTED'
      : `${ocr.engine.toUpperCase()} ${ocrReady ? '● READY' : '○ OFF'}`;

  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '8px 20px',
        borderTop: 'var(--border-hairline)',
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.1em',
        color: 'var(--text-faint)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <StatusLight state={health.ok ? 'ok' : 'error'} blink={!health.ok} />
        LOCAL ENGINE {health.ok ? 'READY' : 'DOWN'}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <StatusLight state={ocrReady ? 'ok' : 'idle'} blink={!ocrReady && Boolean(ocr)} />
        {ocrLabel}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <StatusLight state="idle" />
        NOTES {noteCount}
      </span>
      {ocrCount > 0 && <span>OCR INDEXED {ocrCount}</span>}
      <button
        type="button"
        onClick={onOpenSetup}
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          color: 'var(--text-dim)',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          letterSpacing: 'inherit',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 'var(--radius-2)',
        }}
      >
        SETTINGS
      </button>
    </footer>
  );
}
