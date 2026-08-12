'use client';

/**
 * Reusable dot-matrix primitive. Powers status lights, logo backgrounds,
 * category glyphs, loading states, OCR/search activity indicators and
 * empty states. Never applied to body text.
 */
export function DotMatrix({
  size = 'fine',
  color,
  style,
  className = '',
  ariaHidden = true,
}: {
  size?: 'sparse' | 'fine' | 'dense';
  color?: string;
  style?: React.CSSProperties;
  className?: string;
  ariaHidden?: boolean;
}) {
  const cls = size === 'sparse' ? 'dot-field' : size === 'dense' ? 'dot-field-dense' : 'dot-field-fine';
  return (
    <div
      aria-hidden={ariaHidden}
      className={`${cls} ${className}`}
      style={{
        position: 'relative',
        color: color || 'inherit',
        ...style,
      }}
    />
  );
}

/** A single dot (matrix glyph cell). */
export function Dot({ active = false, color, pulse = false, size = 6 }: {
  active?: boolean;
  color?: string;
  pulse?: boolean;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className={pulse ? 'dot-pulse' : undefined}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 1,
        background: active ? (color || 'var(--text)') : 'var(--line-strong)',
        transition: `background var(--motion-fast) var(--ease-out)`,
      }}
    />
  );
}

/** A row of N dots — used for activity indicators and step progress. */
export function DotRow({ count = 5, activeCount = 0, color, pulse }: {
  count?: number;
  activeCount?: number;
  color?: string;
  pulse?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i < activeCount} color={color} pulse={pulse && i === activeCount - 1} />
      ))}
    </span>
  );
}
