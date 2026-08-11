'use client';

import { Search, Puzzle, Bot } from 'lucide-react';
import { LocalServiceHealth } from '../lib/xhs-client';
import { Led, MatrixLabel, SquareButton, StatCell } from './ui';

export type SetupPanel = 'extension' | 'agent';

export function DashboardHeader({
  subtitle,
  searchQuery,
  onSearchChange,
  totalNotes,
  groupCount,
  ocrCount,
  health,
  onOpenSetup,
}: {
  subtitle: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  totalNotes: number;
  groupCount: number;
  ocrCount: number;
  health: LocalServiceHealth;
  onOpenSetup: (panel: SetupPanel) => void;
}) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '14px 20px',
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {/* Brand block */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minWidth: 0 }}>
        <div
          className="pixel-block"
          style={{
            width: 34,
            height: 34,
            borderRadius: 7,
            border: '1px solid var(--line-strong)',
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.28em',
              color: 'var(--text)',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            看看收藏
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
            <Led state={health.ok ? 'ok' : 'error'} blink={!health.ok} />
            <MatrixLabel>{subtitle}</MatrixLabel>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 380, minWidth: 180 }}>
        <Search
          size={13}
          strokeWidth={1.8}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }}
        />
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onSearchChange('');
          }}
          placeholder="搜索正文 / OCR / 标题"
          aria-label="搜索收藏"
          style={{
            width: '100%',
            height: 34,
            padding: '0 12px 0 34px',
            borderRadius: 7,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 12.5,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: '0 18px',
          height: 44,
          borderLeft: '1px solid var(--line)',
          borderRight: '1px solid var(--line)',
          flexShrink: 0,
        }}
      >
        <StatCell label="笔记" value={totalNotes} />
        <StatCell label="分组" value={groupCount} />
        <StatCell label="OCR" value={ocrCount} accent={ocrCount > 0} />
      </div>

      {/* Setup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <SquareButton onClick={() => onOpenSetup('extension')} title="浏览器插件">
          <Puzzle size={13} strokeWidth={1.8} />
          插件
        </SquareButton>
        <SquareButton onClick={() => onOpenSetup('agent')} title="Agent MCP 连接">
          <Bot size={13} strokeWidth={1.8} />
          Agent
        </SquareButton>
      </div>
    </header>
  );
}
