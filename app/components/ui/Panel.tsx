'use client';

import { ReactNode } from 'react';

/** Rounded geometric panel — main surfaces use 24px radius. */
export function Panel({
  children,
  radius = 'var(--radius-6)',
  style,
  className = '',
}: {
  children: ReactNode;
  radius?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        border: 'var(--border-hairline)',
        borderRadius: radius,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Uppercase mono micro-label. */
export function MatrixLabel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span className="matrix-label" style={style}>
      {children}
    </span>
  );
}

/** Matrix-digit stat block. */
export function StatCell({
  label,
  value,
  accent = false,
  style,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, ...style }}>
      <MatrixLabel>{label}</MatrixLabel>
      <span
        style={{
          fontFamily: 'var(--font-dot)',
          fontSize: 20,
          fontWeight: 400,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.06em',
          color: accent ? 'var(--accent)' : 'var(--text)',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}
