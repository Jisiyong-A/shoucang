'use client';

import { Bot, Download, Puzzle, Search } from 'lucide-react';
import { LocalServiceHealth } from '../../lib/xhs-client';
import { Badge, Button, DotMatrix, StatusLight } from '../ui';
import { SetupPanel } from '../DeskView.types';

export function TitleBar({
  searchQuery,
  onSearchChange,
  health,
  onOpenSetup,
  onImportClick,
  importing,
  compact = false,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  health: LocalServiceHealth;
  onOpenSetup: (panel: SetupPanel) => void;
  onImportClick: () => void;
  importing: boolean;
  /** compact = Google Window Size Class "compact" (<600dp): phone layouts */
  compact?: boolean;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '12px 20px',
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: 'var(--border-hairline)',
        flexShrink: 0,
      }}
    >
      {/* Brand — dot matrix logo + bilingual title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <DotMatrix
          size="dense"
          color="#56565C"
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-3)',
            border: 'var(--border-strong)',
            flexShrink: 0,
          }}
        />
        <div style={{ lineHeight: 1.15 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.3em',
              color: 'var(--text)',
            }}
          >
            收藏
          </div>
          {!compact && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.24em',
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
              }}
            >
              Collection System
            </div>
          )}
        </div>
      </div>

      {/* Search — core control, not an icon */}
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
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onSearchChange('');
          }}
          placeholder="SEARCHING LOCAL ARCHIVE…"
          aria-label="搜索收藏"
          style={{
            width: '100%',
            height: 36,
            padding: '0 12px 0 34px',
            borderRadius: 'var(--radius-3)',
            border: searchQuery ? 'var(--border-strong)' : 'var(--border-hairline)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 12.5,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            outline: 'none',
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Button onClick={onImportClick} disabled={importing} title="粘贴链接导入">
          <Download size={13} strokeWidth={1.8} />
          IMPORT
        </Button>
        {!compact && (
          <>
            <Button onClick={() => onOpenSetup('extension')} title="浏览器插件">
              <Puzzle size={13} strokeWidth={1.8} />
              EXTENSION
            </Button>
            <Button onClick={() => onOpenSetup('agent')} title="Agent MCP 连接">
              <Bot size={13} strokeWidth={1.8} />
              AGENT
            </Button>
          </>
        )}
      </div>

      {/* Local status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingLeft: 4 }}>
        <StatusLight state={health.ok ? 'ok' : 'error'} blink={!health.ok} label="local engine" />
        {!compact && <Badge tone={health.ok ? 'ok' : 'error'}>
          LOCAL {health.ok ? '● READY' : 'OFFLINE'}
        </Badge>}
      </div>
    </header>
  );
}
