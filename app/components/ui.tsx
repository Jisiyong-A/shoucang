'use client';

import { ReactNode } from 'react';

/* ── Dot-Geometry primitives ─────────────────────────────────────────────── */

/** Full-bleed dot-matrix field. */
export function DotField({ fine = false, style }: { fine?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className={fine ? 'dot-field-fine' : 'dot-field'}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, ...style }}
    />
  );
}

/** Rounded geometric panel. */
export function Panel({
  children,
  style,
  className = '',
}: {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
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

/** Status LED: 'ok' | 'error' | 'idle'. */
export function Led({ state = 'idle', blink = false }: { state?: 'ok' | 'error' | 'idle'; blink?: boolean }) {
  const color = state === 'ok' ? 'var(--ok)' : state === 'error' ? 'var(--signal)' : 'var(--text-faint)';
  return (
    <span
      aria-hidden
      className={blink ? 'led-blink' : undefined}
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: 2,
        background: color,
        boxShadow: `0 0 6px ${color}`,
        flexShrink: 0,
      }}
    />
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
          fontFamily: 'var(--font-mono)',
          fontSize: 17,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.06em',
          color: accent ? 'var(--signal)' : 'var(--text)',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Small square tag. */
export function SquareTag({
  children,
  tone = 'default',
  style,
}: {
  children: ReactNode;
  tone?: 'default' | 'signal' | 'ok';
  style?: React.CSSProperties;
}) {
  const background = tone === 'signal' ? 'var(--signal-soft)' : tone === 'ok' ? 'var(--ok-soft)' : 'var(--surface-2)';
  const color = tone === 'signal' ? 'var(--signal)' : tone === 'ok' ? 'var(--ok)' : 'var(--text-dim)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 7px',
        borderRadius: 5,
        background,
        color,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Ghost square button. */
export function SquareButton({
  children,
  onClick,
  disabled,
  title,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 32,
        padding: '0 11px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 7,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.06em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--line-strong)';
        e.currentTarget.style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line)';
        e.currentTarget.style.color = 'var(--text-dim)';
      }}
    >
      {children}
    </button>
  );
}

/** Primary action button (white block, black text — inverted). */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 38,
        padding: '0 16px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        borderRadius: 7,
        border: '1px solid var(--text)',
        background: disabled ? 'var(--surface-3)' : 'var(--text)',
        color: disabled ? 'var(--text-faint)' : '#000',
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        letterSpacing: '0.08em',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
