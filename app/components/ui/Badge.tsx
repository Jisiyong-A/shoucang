'use client';

import { ReactNode } from 'react';

export type BadgeTone = 'default' | 'signal' | 'error' | 'ok' | 'warning';

/** Small square badge (12px radius family). */
export function Badge({
  children,
  tone = 'default',
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  style?: React.CSSProperties;
}) {
  const normalized: BadgeTone = tone === 'error' ? 'signal' : tone;
  const background = normalized === 'signal' ? 'var(--accent-soft)'
    : normalized === 'ok' ? 'var(--success-soft)'
      : normalized === 'warning' ? 'rgba(225, 154, 55, 0.12)'
        : 'var(--surface-2)';
  const color = normalized === 'signal' ? 'var(--accent)'
    : normalized === 'ok' ? 'var(--success)'
      : normalized === 'warning' ? 'var(--warning)'
        : 'var(--text-dim)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 'var(--radius-2)',
        background,
        color,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
