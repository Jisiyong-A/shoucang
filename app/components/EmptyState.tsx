'use client';

import { motion } from 'framer-motion';
import { DotMatrix } from './ui/DotMatrix';

export function EmptyState({ noResults = false }: { noResults?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        color: 'var(--text-faint)',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <DotMatrix
        size="dense"
        color="var(--text-faint)"
        style={{
          width: 88,
          height: 88,
          borderRadius: 'var(--radius-6)',
          border: 'var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
      <div
        style={{
          fontFamily: 'var(--font-dot)',
          fontSize: 24,
          letterSpacing: '0.1em',
          color: 'var(--text-dim)',
        }}
      >
        {noResults ? 'NO MATCH' : 'NO ITEMS'}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--text-faint)' }}>
        {noResults ? 'TRY ANOTHER QUERY' : 'DRAG A NOTE HERE'}
      </div>
      <div style={{ fontSize: 12, maxWidth: 340, lineHeight: 1.8, color: 'var(--text-faint)' }}>
        {noResults
          ? '搜索会命中正文和图片文字'
          : '从小红书页面拖入笔记卡片，松手后自动保存正文、图片并识别图内文字'}
      </div>
    </motion.div>
  );
}
