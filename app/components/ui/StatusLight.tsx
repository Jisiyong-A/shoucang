'use client';

/** Status light — square LED, blink for pending/unhealthy. */
export function StatusLight({
  state = 'idle',
  blink = false,
  label,
}: {
  state?: 'ok' | 'error' | 'warn' | 'idle';
  blink?: boolean;
  label?: string;
}) {
  const color = state === 'ok' ? 'var(--success)'
    : state === 'error' ? 'var(--accent)'
      : state === 'warn' ? 'var(--warning)'
        : 'var(--text-faint)';
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
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
