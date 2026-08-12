'use client';

import { ReactNode } from 'react';

type Variant = 'ghost' | 'primary' | 'danger';

/** Unified button — 12–16px radius family, mono label, 32–38px hit area. */
export function Button({
  children,
  onClick,
  disabled,
  variant = 'ghost',
  title,
  style,
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: Variant;
  title?: string;
  style?: React.CSSProperties;
  size?: 'sm' | 'md';
}) {
  const height = size === 'sm' ? 30 : 36;
  const base: React.CSSProperties = {
    height,
    padding: `0 ${size === 'sm' ? 10 : 14}px`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 'var(--radius-3)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '0.06em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: `border-color var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out), background var(--motion-fast) var(--ease-out)`,
    ...style,
  };

  if (variant === 'primary') {
    Object.assign(base, {
      border: '1px solid var(--text)',
      background: disabled ? 'var(--surface-3)' : 'var(--text)',
      color: disabled ? 'var(--text-faint)' : 'var(--text-inverse)',
      fontWeight: 600,
    });
  } else if (variant === 'danger') {
    Object.assign(base, {
      border: '1px solid var(--accent)',
      background: disabled ? 'var(--surface-3)' : 'var(--accent)',
      color: disabled ? 'var(--text-faint)' : '#fff',
      fontWeight: 600,
    });
  } else {
    Object.assign(base, {
      border: 'var(--border-hairline)',
      background: 'var(--surface)',
      color: 'var(--text-dim)',
      opacity: disabled ? 0.4 : 1,
    });
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={base}
      onMouseEnter={(e) => {
        if (variant === 'ghost' && !disabled) {
          e.currentTarget.style.borderColor = 'var(--line-strong)';
          e.currentTarget.style.color = 'var(--text)';
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'ghost' && !disabled) {
          e.currentTarget.style.borderColor = 'var(--line)';
          e.currentTarget.style.color = 'var(--text-dim)';
        }
      }}
    >
      {children}
    </button>
  );
}
