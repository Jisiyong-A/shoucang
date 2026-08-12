'use client';

import { Search } from 'lucide-react';

export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 420, minWidth: 200 }}>
      <Search
        size={13}
        strokeWidth={1.8}
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-faint)',
          pointerEvents: 'none',
        }}
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onChange('');
        }}
        placeholder="SEARCHING LOCAL ARCHIVE…"
        aria-label="搜索收藏"
        style={{
          width: '100%',
          height: 36,
          padding: '0 12px 0 34px',
          borderRadius: 'var(--radius-3)',
          border: value ? 'var(--border-strong)' : 'var(--border-hairline)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 12.5,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
          outline: 'none',
        }}
      />
    </div>
  );
}
