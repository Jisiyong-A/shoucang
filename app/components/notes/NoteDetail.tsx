'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ExternalLink, Heart, Loader2, MessageCircle, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Note } from '../../types/xiaohongshu';
import { formatDate, formatNumber } from '../../lib/xhs-client';
import { Badge, Button } from '../ui';
import { NoteGallery } from './NoteGallery';

export function NoteDetail({
  note,
  onClose,
  onDelete,
  isDeleting,
}: {
  note: Note;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

  const sourceImageUrls = Array.from(new Set(
    note.imageUrls?.length ? note.imageUrls : (note.coverUrl ? [note.coverUrl] : []),
  ));
  const imageUrls = sourceImageUrls.filter((url) => !failedImageUrls.has(url));
  const rawContent = (note.rawContent || '').trim();
  const ocrText = (note.ocrText || '').trim();
  const category = note.category === 'inbox' ? 'INBOX' : note.category.toUpperCase();

  const markImageFailed = (imageUrl: string) => {
    setFailedImageUrls((current) => {
      if (current.has(imageUrl)) return current;
      const next = new Set(current);
      next.add(imageUrl);
      return next;
    });
  };

  const infoRow = (label: string, value: React.ReactNode) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        padding: '7px 0',
        borderBottom: 'var(--border-hairline)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          color: 'var(--text-faint)',
          flexShrink: 0,
          width: 72,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--text-dim)', minWidth: 0, wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={note.title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.86)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 1060,
          height: 'min(86vh, 820px)',
          background: '#0A0A0C',
          border: 'var(--border-strong)',
          borderRadius: 'var(--radius-6)',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {note.videoLocalPath ? (
          <div
            style={{
              flex: 1.2,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#050506',
              borderRight: 'var(--border-strong)',
            }}
          >
            <video
              controls
              playsInline
              preload="metadata"
              src={note.videoLocalPath}
              style={{ width: '100%', height: '100%', maxHeight: 'min(86vh, 820px)', objectFit: 'contain' }}
            />
          </div>
        ) : (
          <NoteGallery
            imageUrls={imageUrls}
            activeImageIndex={activeImageIndex}
            onSelect={setActiveImageIndex}
            onImageFailed={markImageFailed}
          />
        )}

        {/* NOTE DATA — right geometric block */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '14px 16px',
              borderBottom: 'var(--border-hairline)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Badge tone={note.category === 'inbox' ? 'signal' : 'default'}>{category}</Badge>
              <Badge>{formatDate(note.savedAt)}</Badge>
              {Boolean(ocrText) && <Badge tone="ok">OCR</Badge>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {note.sourceUrl && (
                <a
                  href={note.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="打开原链接"
                  aria-label="打开原链接"
                  style={{
                    display: 'inline-flex',
                    width: 30,
                    height: 30,
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-dim)',
                    borderRadius: 'var(--radius-2)',
                    border: 'var(--border-hairline)',
                  }}
                >
                  <ExternalLink size={13} strokeWidth={1.8} />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                style={{
                  display: 'inline-flex',
                  width: 30,
                  height: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-dim)',
                  borderRadius: 'var(--radius-2)',
                  border: 'var(--border-hairline)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 600,
                lineHeight: 1.45,
                color: 'var(--text)',
              }}
            >
              {note.title}
            </h2>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginTop: 10,
                paddingBottom: 4,
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Heart size={12} /> {formatNumber(note.likes)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MessageCircle size={12} /> {formatNumber(note.comments)}
              </span>
            </div>

            <div style={{ marginTop: 6 }}>
              {infoRow('AUTHOR', note.author?.name || '未知作者')}
              {infoRow('CATEGORY', category)}
              {note.tags?.length > 0 && infoRow('TAGS', note.tags.map((t) => `#${t}`).join(' '))}
              {infoRow('SAVED AT', formatDate(note.savedAt))}
            </div>

            {rawContent ? (
              <div
                style={{
                  marginTop: 14,
                  fontSize: 13.5,
                  lineHeight: 1.85,
                  color: 'var(--text-dim)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {rawContent}
              </div>
            ) : (
              <div style={{ marginTop: 16, color: 'var(--text-faint)', fontSize: 12.5 }}>
                这篇笔记没有可显示的正文。
              </div>
            )}

            {ocrText && (
              <div style={{ marginTop: 16 }}>
                <Button size="sm" onClick={() => setShowOcr((v) => !v)}>
                  {showOcr ? <X size={11} /> : <span>OCR</span>}
                  {showOcr ? '收起识别文本' : `图片文字 ${ocrText.length} 字`}
                </Button>
                <AnimatePresence>
                  {showOcr && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          marginTop: 10,
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-3)',
                          background: '#0D0D0F',
                          border: 'var(--border-hairline)',
                          fontSize: 12.5,
                          lineHeight: 1.8,
                          color: 'var(--text-dim)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: 260,
                          overflowY: 'auto',
                        }}
                      >
                        {ocrText}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Delete zone */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: 'var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            {confirmingDelete ? (
              <>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                  删除后本地图片一并清除
                </span>
                <Button variant="danger" onClick={onDelete} disabled={isDeleting}>
                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  确认删除
                </Button>
                <Button onClick={() => setConfirmingDelete(false)}>取消</Button>
              </>
            ) : (
              <Button
                onClick={() => setConfirmingDelete(true)}
                style={{ color: 'var(--text-dim)' }}
              >
                <Trash2 size={12} />
                删除
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
