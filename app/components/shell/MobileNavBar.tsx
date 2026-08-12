/**
 * MobileNavBar — Material 3 Navigation bar for Window Size Class "compact"
 * (<600dp, phone portrait). LIBRARY · SEARCH · SYSTEM per the mobile design
 * system (Task 11).
 */

import { Library, Search, Settings } from 'lucide-react';

export function MobileNavBar({
  onLibrary,
  onSearch,
  onSystem,
  active = 'library',
}: {
  onLibrary: () => void;
  onSearch: () => void;
  onSystem: () => void;
  active?: 'library' | 'search' | 'system';
}) {
  const item = (
    key: 'library' | 'search' | 'system',
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => (
    <button
      key={key}
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        flex: 1,
        padding: '6px 0 4px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active === key ? 'var(--text)' : 'var(--text-faint)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
      }}
    >
      {icon}
      {label}
      <div
        style={{
          width: 26,
          height: 2,
          borderRadius: 1,
          background: active === key ? 'var(--text)' : 'transparent',
          marginTop: 2,
        }}
      />
    </button>
  );

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 900,
        display: 'flex',
        padding: '6px 12px calc(6px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: 'var(--border-hairline)',
      }}
    >
      {item('library', 'LIBRARY', <Library size={17} strokeWidth={1.6} />, onLibrary)}
      {item('search', 'SEARCH', <Search size={17} strokeWidth={1.6} />, onSearch)}
      {item('system', 'SYSTEM', <Settings size={17} strokeWidth={1.6} />, onSystem)}
    </nav>
  );
}
