'use client';

import { motion } from 'framer-motion';
import { BookMarked, Search } from 'lucide-react';

export function EmptyState({ noResults = false }: { noResults?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
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
      <div
        className="dot-field-fine"
        style={{
          width: 84,
          height: 84,
          borderRadius: 14,
          border: '1px solid var(--line-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {noResults ? (
          <Search size={26} strokeWidth={1.4} />
        ) : (
          <BookMarked size={26} strokeWidth={1.4} />
        )}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 15,
          letterSpacing: '0.18em',
          color: 'var(--text-dim)',
        }}
      >
        {noResults ? '未找到相关收藏' : '把一条笔记拖进来'}
      </div>
      <div style={{ fontSize: 12, maxWidth: 340, lineHeight: 1.8 }}>
        {noResults
          ? '换个关键词试试，搜索会命中正文和图片文字'
          : '从小红书页面拖入笔记卡片，松手后自动保存正文、图片并识别图内文字'}
      </div>
    </motion.div>
  );
}
