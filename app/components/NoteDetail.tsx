'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ExternalLink, Heart, Loader2, MessageCircle, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Note } from '../types/xiaohongshu';
import { formatDate, formatNumber } from '../lib/xhs-client';
import { MatrixLabel, SquareTag } from './ui';

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
  const resolvedImageIndex = Math.min(activeImageIndex, Math.max(imageUrls.length - 1, 0));
  const activeImageUrl = imageUrls[resolvedImageIndex];
  const rawContent = (note.rawContent || '').trim();
  const ocrText = (note.ocrText || '').trim();

  const markImageFailed = (imageUrl: string) => {
    setFailedImageUrls((current) => {
      if (current.has(imageUrl)) return current;
      const next = new Set(current);
      next.add(imageUrl);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
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
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 1060,
          height: 'min(86vh, 820px)',
          background: '#0A0A0C',
          border: '1px solid var(--line-strong)',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {/* ── Gallery ── */}
        <div
          style={{
            flex: '0 0 58%',
            display: 'flex',
            minWidth: 0,
            position: 'relative',
            borderRight: '1px solid var(--line)',
            background: '#060607',
          }}
        >
          {imageUrls.length > 1 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflowY: 'auto',
                padding: '14px 8px 14px 12px',
                borderRight: '1px solid var(--line)',
                flexShrink: 0,
                background: '#0B0B0D',
              }}
            >
              {imageUrls.map((imageUrl, index) => (
                <button
                  key={imageUrl}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={`查看第 ${index + 1} 张图片`}
                  style={{
                    width: 52,
                    height: 66,
                    padding: 0,
                    flexShrink: 0,
                    overflow: 'hidden',
                    borderRadius: 6,
                    border: index === resolvedImageIndex ? '1px solid var(--text)' : '1px solid var(--line)',
                    opacity: index === resolvedImageIndex ? 1 : 0.45,
                    cursor: 'pointer',
                    background: '#000',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={() => markImageFailed(imageUrl)}
                  />
                </button>
              ))}
            </div>
          )}

          {activeImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={activeImageUrl}
              alt={note.title}
              style={{
                flex: 1,
                minWidth: 0,
                objectFit: 'contain',
                display: 'block',
                padding: 18,
              }}
              onError={() => markImageFailed(activeImageUrl)}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="pixel-block" style={{ width: 120, height: 120, borderRadius: 12 }} />
            </div>
          )}
        </div>

        {/* ── Info ── */}
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
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <SquareTag tone={note.category === 'inbox' ? 'signal' : 'default'}>{note.category}</SquareTag>
              <SquareTag tone="default">{formatDate(note.savedAt)}</SquareTag>
              {Boolean(ocrText) && <SquareTag tone="ok">OCR</SquareTag>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {note.sourceUrl && (
                <a
                  href={note.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="打开原链接"
                  style={{
                    display: 'inline-flex',
                    width: 30,
                    height: 30,
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-dim)',
                    borderRadius: 6,
                    border: '1px solid var(--line)',
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
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
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
                marginTop: 12,
                paddingBottom: 13,
                borderBottom: '1px solid var(--line)',
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
              <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {note.author?.name || '未知作者'}
              </span>
            </div>

            {rawContent && (
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
            )}

            {!rawContent && (
              <div style={{ marginTop: 18, color: 'var(--text-faint)', fontSize: 12.5 }}>
                这篇笔记没有可显示的正文。
              </div>
            )}

            {ocrText && (
              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setShowOcr((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '5px 10px',
                    borderRadius: 5,
                    border: `1px solid ${showOcr ? 'var(--text)' : 'var(--line-strong)'}`,
                    background: 'transparent',
                    color: showOcr ? 'var(--text)' : 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                  }}
                >
                  {showOcr ? <X size={11} /> : <MatrixLabel>OCR</MatrixLabel>}
                  {showOcr ? '收起识别文本' : `图片文字 ${ocrText.length} 字`}
                </button>
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
                          borderRadius: 8,
                          background: '#0D0D0F',
                          border: '1px solid var(--line)',
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
              borderTop: '1px solid var(--line)',
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
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isDeleting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '1px solid var(--signal)',
                    background: 'var(--signal)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    cursor: isDeleting ? 'wait' : 'pointer',
                  }}
                >
                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  确认删除
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--signal)';
                  e.currentTarget.style.color = 'var(--signal)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--line)';
                  e.currentTarget.style.color = 'var(--text-dim)';
                }}
              >
                <Trash2 size={12} />
                删除
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
