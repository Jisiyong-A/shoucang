/* Hallmark · component: search + setup dialog · genre: modern-minimal
 * states: default · hover · focus · active · disabled · loading · error · success
 * pre-emit critique: P5 H5 E4 S5 R5 V4
 */
'use client';

import { useState, useEffect, useRef, useMemo, type DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Heart,
  Loader2,
  Plus,
  Pencil,
  Check,
  BookMarked,
  Trash2,
  Search,
  Puzzle,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { Note } from '../types/xiaohongshu';
import { useNotes, useApp } from '../lib/store';
import {
  formatNumber,
  connectLocalAgent,
  deleteStoredNote,
  formatDate,
  getLocalServiceHealth,
  getLocalSetupInfo,
  importSharedNote,
  openBrowserExtensionSetup,
} from '../lib/xhs-client';
import type { AgentClient, LocalServiceHealth, LocalSetupInfo } from '../lib/xhs-client';
import {
  acceptsExternalNoteDrag,
  parseDraggedCardInput,
  selectDraggedNoteInput,
} from '../lib/drag-import.mjs';
import {
  CARD_H,
  CARD_IMAGE_H,
  CARD_TITLE_LINES,
  CARD_W,
  EXPANDED_GRID_GAP_X,
  EXPANDED_GRID_GAP_Y,
} from '../lib/desk-card-metrics.mjs';
import { shouldUseLightweightCanvas } from '../lib/desk-performance.mjs';
import { filterNotesByQuery } from '../../scripts/lib/note-search.mjs';
import {
  createDeskGroup,
  ensureDeskState,
  getNotesInGroup,
  moveNoteToGroup,
  renameDeskGroup,
} from '../lib/desk-workspace.mjs';

// ── Constants ─────────────────────────────────────────────────────────────────
const TITLEBAR_SAFE_TOP = 34;
const TITLEBAR_SAFE_LEFT = 12;
const DRAG_PAYLOAD_PREFIX = 'KANKAN_NOTE:';

type ImportPhase = 'idle' | 'dragging' | 'recognized' | 'processing' | 'complete' | 'error';

type ImportFeedback = {
  phase: ImportPhase;
  title: string;
  message: string;
};

const IDLE_IMPORT_FEEDBACK: ImportFeedback = { phase: 'idle', title: '', message: '' };

function getDraggedNoteTitle(input: string): string {
  const card = parseDraggedCardInput(input);
  if (card?.title) return card.title;

  const markerIndex = input.indexOf(DRAG_PAYLOAD_PREFIX);
  if (markerIndex === -1) return '这条笔记';

  try {
    const payload = JSON.parse(input.slice(markerIndex + DRAG_PAYLOAD_PREFIX.length));
    return typeof payload?.title === 'string' && payload.title.trim()
      ? payload.title.trim().slice(0, 52)
      : '这条笔记';
  } catch {
    return '这条笔记';
  }
}

// ── Category colors ───────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  工作方法: '#829987', 设计美学: '#6B8799', 学习方法: '#B89A52',
  身心健康: '#CC8C73', 食物科学: '#8BA882', 阅读思考: '#9B8EA0',
  摄影:     '#7A95A8', 生活哲学: '#C4A882', 咖啡科学: '#A67C52',
  植物:     '#6E9478', 空间美学: '#8B9AB5', 茶文化:   '#7B8F6E',
  艺术:     '#B5849B', 创作:     '#B07856', 户外:     '#6E8E7A',
  AI工具:   '#6B8799', 编程开发: '#5E7FA3', 旅行户外: '#6E8E7A',
  美食餐饮: '#A67C52', 影像创作: '#B07856', 方法论:   '#829987',
  生活方式: '#8BA882',
};
const catColor = (c: string) => CAT_COLORS[c] ?? '#829987';

// ── Seeded random ─────────────────────────────────────────────────────────────
function sr(seed: number): number {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

type Pos = { x: number; y: number; rot: number; z: number; breathOffset: number };
type DeskGroup = {
  id: string;
  name: string;
  kind: 'auto' | 'custom' | 'inbox';
  sourceCategory?: string;
};
type DeskState = {
  groups: DeskGroup[];
  noteGroupMap: Record<string, string>;
  knownNoteIds?: string[];
};
type GroupLabel = {
  groupId: string;
  name: string;
  y: number;
  x: number;
  color: string;
  kind: DeskGroup['kind'];
  noteCount: number;
};
const DESK_WORKSPACE_STORAGE_KEY = 'kankanshoucang:desk-workspace:v1';

// ── Organized layout (cards grouped by category clusters) ─────────────────────
type OrgResult = {
  positions: Record<string, Pos>;
  labels: GroupLabel[];
};

function buildOrganized(
  notes: Note[],
  groups: DeskGroup[],
  noteGroupMap: Record<string, string>,
  w: number,
  activeGroupId: string | null,
  hideEmptyGroups = false,
): OrgResult {
  const visibleGroups = groups.filter((group) => {
    const noteCount = getNotesInGroup(notes, noteGroupMap, group.id).length;
    if (hideEmptyGroups) return noteCount > 0;
    if (group.kind === 'auto') return noteCount > 0;
    return group.id !== 'inbox' || noteCount > 0;
  });
  const grouped: Record<string, Note[]> = {};
  visibleGroups.forEach((group) => {
    grouped[group.id] = getNotesInGroup(notes, noteGroupMap, group.id);
  });

  const clusterCols = w > 900 ? 3 : 2;
  const clusterPadX = 60;
  const clusterH = 360;
  const availableW = w - clusterPadX * 2;
  const clusterW = availableW / clusterCols;

  const positions: Record<string, Pos> = {};
  const labels: OrgResult['labels'] = [];

  visibleGroups.forEach((group, ci) => {
    const col = ci % clusterCols;
    const row = Math.floor(ci / clusterCols);

    const cx = clusterPadX + col * clusterW + clusterW / 2;
    const cy = 20 + row * clusterH + clusterH / 2;

    const labelX = cx - 30;
    const groupColor = group.kind === 'auto'
      ? catColor(group.sourceCategory || group.name)
      : group.kind === 'inbox'
        ? '#A67C52'
        : '#829987';
    labels.push({
      groupId: group.id,
      name: group.name,
      y: cy - 155,
      x: labelX,
      color: groupColor,
      kind: group.kind,
      noteCount: grouped[group.id].length,
    });

    const catNotes = grouped[group.id];
    const isExpanded = group.id === activeGroupId;

    catNotes.forEach((note, i) => {
      if (isExpanded) {
        // 展开状态：以标签为中心向下进行网格平铺
        const cols = w > 600 ? 3 : 2;
        const gapX = EXPANDED_GRID_GAP_X;
        const gapY = EXPANDED_GRID_GAP_Y;
        const gridCol = i % cols;
        const gridRow = Math.floor(i / cols);

        const totalWidth = (Math.min(catNotes.length, cols) - 1) * gapX;
        const offsetX = gridCol * gapX - totalWidth / 2;
        const offsetY = gridRow * gapY;

        positions[note.id] = {
          x: cx + offsetX,
          y: cy + 30 + offsetY,
          rot: 0,
          z: 300 + i,
          breathOffset: 0
        };
      } else {
        // 折叠状态：原本的自然凌乱堆叠
        const angle = (i * 1.618) % (Math.PI * 2);
        const radius = Math.min(i * 3, 25) + (sr(i * 3 + ci) - 0.5) * 20;
        const offsetX = Math.cos(angle) * radius + (sr(i * 7 + ci) - 0.5) * 20;
        const offsetY = Math.sin(angle) * radius * 0.6 + (sr(i * 11 + ci) - 0.5) * 15;

        positions[note.id] = {
          x: cx + offsetX,
          y: cy + offsetY,
          rot: (sr(i * 13 + ci * 3 + 2) - 0.5) * 28,
          z: Math.floor(sr(i * 17 + ci * 2 + 3) * 20) + ci * 15,
          breathOffset: sr(i * 19 + ci) * 3
        };
      }
    });
  });

  return { positions, labels };
}

// ── Expanded note reader ──────────────────────────────────────────────────────
function ExpandedCard({
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
  const color = catColor(note.category);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const sourceImageUrls = Array.from(new Set(
    note.imageUrls?.length ? note.imageUrls : (note.coverUrl ? [note.coverUrl] : []),
  ));
  const imageUrls = sourceImageUrls.filter(imageUrl => !failedImageUrls.has(imageUrl));
  const resolvedImageIndex = Math.min(activeImageIndex, Math.max(imageUrls.length - 1, 0));
  const activeImageUrl = imageUrls[resolvedImageIndex];
  const rawContent = (note.rawContent || '').trim();
  const ocrText = (note.ocrText || '').trim();

  const markImageFailed = (imageUrl: string) => {
    setFailedImageUrls(current => {
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
      transition={{ duration: 0.25 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(225,221,214,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FDFCFA',
          borderRadius: 22,
          width: '100%',
          maxWidth: 1080,
          height: 'min(86vh, 820px)',
          overflow: 'hidden',
          boxShadow: '0 32px 100px rgba(55,45,25,0.28), 0 12px 32px rgba(55,45,25,0.15)',
          display: 'flex',
        }}
      >
        {/* Visual gallery */}
        <div style={{
          flex: '0 0 58%',
          display: 'flex',
          borderRight: '1px solid rgba(0,0,0,0.06)',
          background: '#EAE7E0',
          minWidth: 0,
          position: 'relative',
        }}>
          {imageUrls.length > 1 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              overflowY: 'auto',
              padding: '18px 10px 18px 14px',
              background: 'rgba(244,242,237,0.72)',
              borderRight: '1px solid rgba(0,0,0,0.05)',
              flexShrink: 0,
            }}>
              {imageUrls.map((imageUrl, index) => (
                <button
                  key={imageUrl}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={`查看第 ${index + 1} 张图片`}
                  style={{
                    width: 54,
                    height: 68,
                    padding: 0,
                    flexShrink: 0,
                    overflow: 'hidden',
                    borderRadius: 9,
                    border: index === resolvedImageIndex
                      ? `2px solid ${color}`
                      : '2px solid transparent',
                    background: '#E8E5DE',
                    cursor: 'pointer',
                    opacity: index === resolvedImageIndex ? 1 : 0.68,
                    boxShadow: index === resolvedImageIndex ? `0 4px 14px ${color}30` : 'none',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={() => markImageFailed(imageUrl)}
                  />
                </button>
              ))}
            </div>
          )}
          <div style={{
            flex: 1,
            minWidth: 0,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
            overflow: 'hidden',
          }}>
            {activeImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeImageUrl}
                alt={note.title}
                draggable={false}
                style={{
                  width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                  filter: 'saturate(0.9) contrast(1.02)',
                }}
                onError={() => markImageFailed(activeImageUrl)}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(145deg, ${color}18, ${color}40)`,
                color, fontFamily: '"Playfair Display", Georgia, serif', fontSize: 72, fontWeight: 600,
              }}>
                {note.title.slice(0, 1)}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              style={{
                position: 'absolute', top: 16, left: 16,
                background: 'rgba(253,252,250,0.92)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0,0,0,0.05)', borderRadius: '50%',
                width: 36, height: 36, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 12px rgba(0,0,0,0.1)',
              }}
            >
              <X size={15} color="#404047" strokeWidth={2} />
            </button>
            {imageUrls.length > 1 && (
              <div style={{
                position: 'absolute', right: 16, bottom: 16, padding: '5px 10px', borderRadius: 999,
                background: 'rgba(50,48,44,0.72)', color: '#fff', fontSize: 10.5,
                backdropFilter: 'blur(8px)',
              }}>
                {resolvedImageIndex + 1} / {imageUrls.length}
              </div>
            )}
          </div>
        </div>

        {/* Original note */}
        <div style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          padding: '30px 32px 34px',
          background: '#FDFCFA',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 9px', borderRadius: 999, background: `${color}14`,
              color, fontSize: 10.5, fontWeight: 600,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              {note.category}
            </div>
            {confirmingDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={isDeleting}
                  style={{ border: 'none', background: 'transparent', color: '#8C8780', fontSize: 11, cursor: 'pointer', padding: '5px 7px' }}>
                  取消
                </button>
                <button type="button" onClick={onDelete} disabled={isDeleting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 999,
                    background: 'rgba(181,106,91,0.11)', color: '#A85F52', fontSize: 11,
                    cursor: isDeleting ? 'default' : 'pointer', padding: '6px 10px',
                  }}>
                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {isDeleting ? '删除中' : '确认删除'}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent',
                  color: '#AAA49C', fontSize: 10.5, cursor: 'pointer', padding: '5px 4px',
                }}>
                <Trash2 size={12} strokeWidth={1.7} /> 删除
              </button>
            )}
          </div>

          <h2 style={{
            margin: '22px 0 10px', fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 25, lineHeight: 1.38, fontWeight: 600, color: '#35343A', letterSpacing: '-0.02em',
          }}>
            {note.title}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9A958D', fontSize: 11 }}>
            <span>@{note.author.name}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#C7C2BA' }} />
            <span>{formatDate(note.savedAt)}</span>
          </div>

          <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '24px 0' }} />
          <p style={{
            margin: 0, fontSize: 13.5, color: '#5E5A54', lineHeight: 1.9,
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          }}>
            {rawContent || '这条笔记没有可见正文。'}
          </p>

          {Array.isArray(note.tags) && note.tags.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 22,
            }}>
              {note.tags.map((tag) => (
                <span key={tag} style={{
                  padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.035)',
                  color: '#8D8881', fontSize: 10.5,
                }}>#{tag}</span>
              ))}
            </div>
          )}

          {ocrText && (
            <div style={{ marginTop: 26, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 18 }}>
              <button type="button" onClick={() => setShowOcr((value) => !value)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                  color: '#666159', fontSize: 12, fontWeight: 600,
                }}>
                <span>图片文字</span>
                <span style={{ color: '#AAA49C', fontSize: 10.5, fontWeight: 400 }}>
                  {showOcr ? '收起' : '展开 OCR'}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {showOcr && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      margin: '14px 0 0', overflow: 'hidden', whiteSpace: 'pre-wrap',
                      color: '#777168', fontSize: 12, lineHeight: 1.8,
                    }}>
                    {ocrText}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}

          {note.mediaStatus === 'partial' && (
            <p style={{ marginTop: 16, fontSize: 10.5, color: '#B56A5B', lineHeight: 1.5 }}>
              {note.mediaError || '部分图片或文字未能完整保存。'}
            </p>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 18, marginTop: 28, paddingTop: 18,
            borderTop: '1px solid rgba(0,0,0,0.05)', color: '#AAA49C', fontSize: 11,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Heart size={13} strokeWidth={1.6} /> {formatNumber(note.likes)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <BookMarked size={13} strokeWidth={1.6} /> {formatNumber(note.collects)}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Individual card with breathe animation ────────────────────────────────────
function DeskCard({
  note, pos, isDimmed, lightweight, onClick, onDragStart, onDragEnd
}: {
  note: Note;
  pos: Pos;
  isDimmed?: boolean;
  lightweight?: boolean;
  onClick: () => void;
  onDragStart?: (noteId: string) => void;
  onDragEnd?: () => void;
}) {
  const color = catColor(note.category);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        x: pos.x,
        y: pos.y,
        rotate: pos.rot,
        zIndex: isDimmed ? 0 : pos.z,
        opacity: isDimmed ? 0.35 : 1,
        scale: isDimmed ? 0.75 : 1,
      }}
      transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.8 }}
      whileHover={isDimmed ? undefined : { scale: 1.06, zIndex: pos.z + 100, transition: { duration: 0.15 } }}
      whileTap={isDimmed ? undefined : { scale: 0.96 }}
      onClick={isDimmed ? undefined : onClick}
      style={{
        position: 'absolute',
        width: CARD_W,
        left: -CARD_W / 2,
        top: -CARD_H / 2,
        cursor: isDimmed ? 'default' : 'grab',
        pointerEvents: isDimmed ? 'none' : 'auto',
        transformOrigin: 'center center',
        willChange: 'transform, opacity',
      }}
      draggable={!isDimmed}
      onDragStart={() => onDragStart?.(note.id)}
      onDragEnd={() => onDragEnd?.()}
    >
      <motion.div
        animate={lightweight ? undefined : {
          scale: [1, 1.015, 1],
          y: [0, -2, 0],
        }}
        transition={lightweight ? undefined : {
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: pos.breathOffset,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <div style={{
          background: '#FDFCFA', borderRadius: 10,
          padding: '7px 7px 18px',
          boxShadow: `
            0 2px 6px rgba(55,45,25,0.08),
            0 8px 24px rgba(55,45,25,0.10),
            0 0 0 1px rgba(0,0,0,0.02)
          `,
          userSelect: 'none',
        }}>
          <div style={{
            borderRadius: 6,
            overflow: 'hidden',
            height: CARD_IMAGE_H,
            background: '#f0f0f0',
          }}>
            {note.coverUrl ? (
              <>
                {/* External note images cannot use Next Image without a stable host allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={note.coverUrl}
                  alt={note.title}
                  draggable={false}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover', display: 'block',
                    filter: 'saturate(0.78) contrast(1.06) sepia(0.05)',
                  }}
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                />
              </>
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(145deg, ${color}22, ${color}55)`,
                color, fontFamily: '"Playfair Display", Georgia, serif', fontSize: 38, fontWeight: 600,
              }}>
                {note.title.slice(0, 1)}
              </div>
            )}
          </div>

          <div style={{ padding: '7px 3px 0' }}>
            <span style={{
              display: 'inline-block',
              fontSize: 8.5,
              fontWeight: 600,
              color,
              background: `${color}18`,
              borderRadius: 3,
              padding: '1px 5px',
              letterSpacing: '0.02em',
              marginBottom: 4,
            }}>
              {note.category}
            </span>
            <p style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 12.5,
              fontWeight: 500,
              color: '#3A3840',
              lineHeight: 1.52,
              letterSpacing: '-0.003em',
              display: '-webkit-box',
              WebkitLineClamp: CARD_TITLE_LINES,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              margin: 0,
            }}>
              {note.title}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

type SetupPanel = 'extension' | 'agent';

function SetupDialog({
  panel,
  info,
  loading,
  message,
  connectingClient,
  connectedClients,
  onClose,
  onOpenExtension,
  onConnectAgent,
}: {
  panel: SetupPanel;
  info: LocalSetupInfo | null;
  loading: boolean;
  message: string;
  connectingClient: AgentClient | null;
  connectedClients: Set<AgentClient>;
  onClose: () => void;
  onOpenExtension: () => void;
  onConnectAgent: (client: AgentClient) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 310,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 28,
        background: 'rgba(73, 67, 57, 0.18)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.22 }}
        style={{
          width: 'min(440px, calc(100vw - 48px))',
          borderRadius: 24,
          background: 'rgba(253,252,250,0.98)',
          border: '1px solid rgba(255,255,255,0.72)',
          boxShadow: '0 34px 90px rgba(73,56,28,0.2)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '25px 26px 24px', position: 'relative' }}>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              position: 'absolute', top: 18, right: 18,
              width: 34, height: 34, borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.06)', background: '#F4F2ED',
              color: '#6F6B64', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>

          <h2 style={{
            margin: 0, color: '#3A3840', fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 21, fontWeight: 600,
          }}>
            {panel === 'extension' ? '浏览器插件' : '连接 Agent'}
          </h2>

          {loading ? (
            <div style={{ height: 132, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#829987' }}>
              <Loader2 size={21} className="animate-spin" />
            </div>
          ) : panel === 'extension' ? (
            <div style={{ marginTop: 24 }}>
              <button
                onClick={onOpenExtension}
                disabled={!info?.extension.available}
                style={{
                  width: '100%', height: 46, border: 'none', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: info?.extension.available ? '#829987' : '#C8C7C2',
                  color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: info?.extension.available ? 'pointer' : 'not-allowed',
                  opacity: info?.extension.available ? 1 : 0.58,
                }}
              >
                <ExternalLink size={15} />
                配置 Chrome 插件
              </button>
              <details style={{ marginTop: 14, color: '#8B857D' }}>
                <summary style={{ cursor: 'pointer', fontSize: 11.5, textAlign: 'center', listStylePosition: 'inside' }}>
                  安装帮助
                </summary>
                <div style={{ marginTop: 11, padding: '12px 14px', borderRadius: 12, background: '#F5F3EE', fontSize: 11.5, lineHeight: 1.8 }}>
                  打开开发者模式，然后点“加载已解压的扩展程序”，选择刚打开的文件夹。
                </div>
              </details>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <div style={{ borderTop: '1px solid rgba(73,56,28,0.08)' }}>
                {([
                  ['codex', 'Codex'],
                  ['claude', 'Claude Code'],
                ] as const).map(([client, label]) => {
                  const detected = info?.agent.clients[client].available;
                  const connected = connectedClients.has(client);
                  const connecting = connectingClient === client;
                  return (
                    <div key={client} style={{
                      minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                      borderBottom: '1px solid rgba(73,56,28,0.08)',
                    }}>
                      <strong style={{ fontSize: 13.5, color: '#454248', fontWeight: 600 }}>{label}</strong>
                      <button
                        onClick={() => onConnectAgent(client)}
                        disabled={!detected || connecting}
                        style={{
                          width: 94, height: 38, borderRadius: 12,
                          border: connected ? '1px solid rgba(130,153,135,0.28)' : 'none',
                          background: connected ? 'rgba(130,153,135,0.09)' : detected ? '#829987' : '#D2D0CB',
                          color: connected ? '#627567' : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          fontSize: 12, fontWeight: 600,
                          cursor: detected && !connected ? 'pointer' : 'default',
                          opacity: detected ? 1 : 0.58,
                        }}
                      >
                        {connecting ? <Loader2 size={14} className="animate-spin" /> : connected ? <Check size={14} /> : <Bot size={14} />}
                        {connecting ? '连接中' : connected ? '已连接' : detected ? '连接' : '未安装'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {message && (
            <div style={{
              marginTop: 14, color: '#5E7564', fontSize: 11.5, textAlign: 'center',
            }}>{message}</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function DeskView() {
  const { notes, setNotes } = useNotes();
  const { state, dispatch } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);

  const [deskState, setDeskState] = useState<DeskState>({ groups: [], noteGroupMap: {}, knownNoteIds: [] });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Note | null>(null);
  const [dims, setDims] = useState({ w: 1200, h: 800 });
  const [serviceHealth, setServiceHealth] = useState<LocalServiceHealth>({ ok: false, source: 'sidecar' });
  const [importFeedback, setImportFeedback] = useState<ImportFeedback>(IDLE_IMPORT_FEEDBACK);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [setupPanel, setSetupPanel] = useState<SetupPanel | null>(null);
  const [setupInfo, setSetupInfo] = useState<LocalSetupInfo | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');
  const [connectingClient, setConnectingClient] = useState<AgentClient | null>(null);
  const [connectedClients, setConnectedClients] = useState<Set<AgentClient>>(() => new Set());

  const loadLocalStatus = async () => {
    setServiceHealth(await getLocalServiceHealth());
  };

  const openSetupPanel = async (panel: SetupPanel) => {
    setSetupPanel(panel);
    setSetupMessage('');
    setSetupLoading(true);
    try {
      setSetupInfo(await getLocalSetupInfo());
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : '本地配置服务未连接');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleOpenExtensionSetup = async () => {
    setSetupMessage('');
    try {
      const result = await openBrowserExtensionSetup();
      setSetupMessage(result.message);
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : '没有打开插件配置');
    }
  };

  const handleConnectAgent = async (client: AgentClient) => {
    setConnectingClient(client);
    setSetupMessage('');
    try {
      const result = await connectLocalAgent(client);
      setConnectedClients((current) => new Set(current).add(client));
      setSetupMessage(result.message);
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : 'Agent 连接失败');
    } finally {
      setConnectingClient(null);
    }
  };

  const dismissImportFeedback = (phase: ImportPhase, delay = 2800) => {
    window.setTimeout(() => {
      setImportFeedback((current) => current.phase === phase ? IDLE_IMPORT_FEEDBACK : current);
    }, delay);
  };

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({
          w: containerRef.current.offsetWidth,
          h: containerRef.current.offsetHeight,
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const loadInitialStatus = async () => {
      setServiceHealth(await getLocalServiceHealth());
    };

    void loadInitialStatus();

    const intervalId = window.setInterval(() => void loadInitialStatus(), 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let rawState = {};
    try {
      const saved = window.localStorage.getItem(DESK_WORKSPACE_STORAGE_KEY);
      rawState = saved ? JSON.parse(saved) : {};
    } catch {
      rawState = {};
    }

    const nextState = ensureDeskState(rawState, notes) as DeskState;
    setDeskState(nextState);
  }, [notes]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(DESK_WORKSPACE_STORAGE_KEY, JSON.stringify(deskState));
  }, [deskState]);

  const groupNameById = useMemo(
    () => new Map(deskState.groups.map((group) => [group.id, group.name])),
    [deskState.groups],
  );
  const visibleNotes = useMemo(
    () => filterNotesByQuery(
      notes,
      searchQuery,
      (note: Note) => groupNameById.get(deskState.noteGroupMap?.[note.id] || 'inbox') || '',
    ) as Note[],
    [notes, searchQuery, groupNameById, deskState.noteGroupMap],
  );
  const hasActiveSearch = searchQuery.trim().length > 0;
  const org = useMemo(
    () => buildOrganized(
      visibleNotes,
      deskState.groups,
      deskState.noteGroupMap || {},
      dims.w,
      activeCategory,
      hasActiveSearch,
    ),
    [visibleNotes, deskState.groups, deskState.noteGroupMap, dims.w, activeCategory, hasActiveSearch],
  );

  const positions = org.positions;
  const labels = org.labels;
  const clusterColumns = dims.w > 900 ? 3 : 2;
  const groupDropZoneWidth = Math.max((dims.w - 120) / clusterColumns - 20, 220);
  const draggedNoteGroupId = draggedNoteId
    ? (deskState.noteGroupMap?.[draggedNoteId] || 'inbox')
    : null;
  const lightweightCanvas = useMemo(() => shouldUseLightweightCanvas(visibleNotes.length), [visibleNotes.length]);

  // Calculate total height for scrolling
  const allY = Object.values(positions).map(p => p.y);
  const maxY = allY.length > 0 ? Math.max(...allY) : 0;
  const minH = Math.ceil(Math.max(labels.length, 1) / (dims.w > 900 ? 3 : 2)) * 320 + 160;
  const containerH = Math.max(maxY + CARD_H + 100, minH);

  const runImport = async (value: string) => {
    const input = value.trim();
    if (!input || state.isLoading) return;
    const draggedCard = parseDraggedCardInput(input);

    if (!canUseLocalService) {
      setImportFeedback({
        phase: 'error',
        title: '本地服务未连接',
        message: '请重新启动看看收藏后再试',
      });
      dismissImportFeedback('error');
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    setImportFeedback({
      phase: 'recognized',
      title: getDraggedNoteTitle(input),
      message: '已接收',
    });

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
      setImportFeedback((current) => ({
        ...current,
        phase: 'processing',
        message: draggedCard
          ? '正在匿名解析正文和图片…'
          : '正在保存图片与文字…',
      }));

      const result = await importSharedNote(input);
      setNotes(result.notes);
      setImportFeedback({
        phase: 'complete',
        title: result.note.title,
        message: result.created ? '已收录' : '内容已更新',
      });
      await loadLocalStatus();
      window.setTimeout(() => {
        setImportFeedback((current) => current.phase === 'complete' ? IDLE_IMPORT_FEEDBACK : current);
      }, 1800);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : '导入失败，请检查链接后重试';
      setImportFeedback({
        phase: 'error',
        title: '没有收录成功',
        message,
      });
      dismissImportFeedback('error', 3600);
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleExternalDrop = (event: DragEvent<HTMLDivElement>) => {
    if (draggedNoteId) return;
    event.preventDefault();
    event.stopPropagation();
    const input = selectDraggedNoteInput({
      custom: event.dataTransfer.getData('application/x-kankan-note')
        || event.dataTransfer.getData('application/x-kankan-card'),
      plain: event.dataTransfer.getData('text/plain'),
      uriList: event.dataTransfer.getData('text/uri-list'),
      mozUrl: event.dataTransfer.getData('text/x-moz-url'),
    });
    if (input.trim()) {
      void runImport(input);
    } else {
      setImportFeedback({
        phase: 'error',
        title: '没有识别到笔记',
        message: '请直接拖动小红书搜索结果里的笔记卡片或封面',
      });
      dismissImportFeedback('error');
    }
  };

  const handleCreateGroup = () => {
    setDeskState((prev) => {
      const next = createDeskGroup(prev, '新分组') as DeskState;
      const created = next.groups.find((group) => !prev.groups?.some((current) => current.id === group.id) && group.kind === 'custom');
      if (created) {
        setActiveCategory(created.id);
        setEditingGroupId(created.id);
        setEditingGroupName(created.name);
      }
      return next;
    });
  };

  const handleStartRename = (groupId: string, currentName: string) => {
    setEditingGroupId(groupId);
    setEditingGroupName(currentName);
  };

  const handleCommitRename = () => {
    if (!editingGroupId) {
      return;
    }

    setDeskState((prev) => renameDeskGroup(prev, editingGroupId, editingGroupName) as DeskState);
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  const handleMoveNoteToGroup = (noteId: string, groupId: string) => {
    setDeskState((prev) => moveNoteToGroup(prev, noteId, groupId) as DeskState);
    setDropTargetGroupId(null);
  };

  const handleDeleteNote = async (note: Note) => {
    if (deletingNoteId) return;
    setDeletingNoteId(note.id);
    try {
      const result = await deleteStoredNote(note.id);
      setExpanded(null);
      setNotes(result.notes);
      setImportFeedback({
        phase: 'complete',
        title: note.title,
        message: '已从收藏和本地图片中删除',
      });
      dismissImportFeedback('complete', 1800);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '删除失败，请重试';
      setImportFeedback({ phase: 'error', title: '没有删除成功', message });
      dismissImportFeedback('error', 3200);
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleDragStart = (noteId: string) => {
    setDraggedNoteId(noteId);
  };

  const handleDragEnd = () => {
    setDraggedNoteId(null);
    setDropTargetGroupId(null);
  };

  const canUseLocalService = serviceHealth.source === 'sidecar' && serviceHealth.ok;

  const subtitle = state.error
    ? state.error
    : state.isLoading
      ? '加载中…'
      : hasActiveSearch
        ? `找到 ${visibleNotes.length} 条`
        : `${notes.length} 条笔记`;

  const isEmpty = notes.length === 0;
  const hasNoSearchResults = !isEmpty && hasActiveSearch && visibleNotes.length === 0;

  return (
    <div
      ref={containerRef}
      onDragEnter={(event) => {
        if (!draggedNoteId && acceptsExternalNoteDrag(event.dataTransfer.types)) {
          event.preventDefault();
          setImportFeedback({
            phase: 'dragging',
            title: '松手收录',
            message: '',
          });
        }
      }}
      onDragOver={(event) => {
        if (!draggedNoteId && acceptsExternalNoteDrag(event.dataTransfer.types)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          if (importFeedback.phase === 'idle') {
            setImportFeedback({
              phase: 'dragging',
              title: '松手收录',
              message: '',
            });
          }
        }
      }}
      onDragLeave={(event) => {
        if (draggedNoteId) return;
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        setImportFeedback(IDLE_IMPORT_FEEDBACK);
      }}
      onDrop={handleExternalDrop}
      style={{
        minHeight: '100vh',
        background: '#EBE9E4',
        position: 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Ambient light */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          'radial-gradient(ellipse 55% 45% at 22% 18%, rgba(217,179,102,0.09) 0%, transparent 70%)',
          'radial-gradient(ellipse 45% 55% at 82% 78%, rgba(130,153,135,0.08) 0%, transparent 70%)',
          'radial-gradient(ellipse 35% 35% at 55% 45%, rgba(204,140,115,0.05) 0%, transparent 60%)',
        ].join(', '),
      }} />

      <AnimatePresence>
        {importFeedback.phase !== 'idle' && !draggedNoteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={handleExternalDrop}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: importFeedback.phase === 'dragging'
                ? 'rgba(235,233,228,0.58)'
                : 'rgba(235,233,228,0.82)',
              backdropFilter: importFeedback.phase === 'dragging' ? 'blur(5px)' : 'blur(10px)',
              WebkitBackdropFilter: importFeedback.phase === 'dragging' ? 'blur(5px)' : 'blur(10px)',
              pointerEvents: importFeedback.phase === 'dragging' ? 'auto' : 'none',
              boxShadow: importFeedback.phase === 'dragging'
                ? 'inset 0 0 0 2px rgba(130,153,135,0.52)'
                : 'none',
            }}
          >
            {importFeedback.phase === 'dragging' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: [1, 1.06, 1] }}
                transition={{ opacity: { duration: 0.18 }, scale: { duration: 1.35, repeat: Infinity, ease: 'easeInOut' } }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13, color: '#4F6254' }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(253,252,250,0.88)', border: '1px solid rgba(130,153,135,0.3)',
                  boxShadow: '0 16px 48px rgba(73,56,28,0.13)',
                }}>
                  <BookMarked size={25} strokeWidth={1.7} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em' }}>松手收录</span>
              </motion.div>
            ) : (
              <motion.div
                layout initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                style={{
                  minWidth: 340, maxWidth: 560, display: 'flex', alignItems: 'center', gap: 15,
                  padding: '15px 20px', borderRadius: 20,
                  color: importFeedback.phase === 'error' ? '#8F5146' : '#4F6254',
                  background: 'rgba(253,252,250,0.94)', border: '1px solid rgba(130,153,135,0.22)',
                  boxShadow: '0 22px 70px rgba(73,56,28,0.13)',
                }}
              >
                <motion.div
                  animate={importFeedback.phase === 'processing' ? { rotate: 360 } : { rotate: 0 }}
                  transition={importFeedback.phase === 'processing'
                    ? { duration: 1, repeat: Infinity, ease: 'linear' }
                    : { duration: 0.2 }}
                  style={{
                    width: 40, height: 40, flexShrink: 0, borderRadius: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: importFeedback.phase === 'error' ? 'rgba(181,106,91,0.12)' : 'rgba(130,153,135,0.14)',
                  }}
                >
                  {importFeedback.phase === 'processing' ? <Loader2 size={19} />
                    : importFeedback.phase === 'complete' || importFeedback.phase === 'recognized' ? <Check size={19} strokeWidth={2.2} />
                      : <X size={19} strokeWidth={2.2} />}
                </motion.div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: '"Playfair Display", Georgia, serif', fontSize: 17, fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{importFeedback.title}</div>
                  {importFeedback.message && (
                    <div style={{ marginTop: 3, fontSize: 11.5, color: '#78716C' }}>{importFeedback.message}</div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${12 + TITLEBAR_SAFE_TOP}px 20px 12px ${20 + TITLEBAR_SAFE_LEFT}px`,
        background: 'rgba(235,233,228,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
      }}>
        <div style={{ width: 190, flexShrink: 0 }}>
          <h1 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 16, fontWeight: 600, color: '#3A3840',
            letterSpacing: '-0.015em', lineHeight: 1,
          }}>
            看看收藏
          </h1>
          <p style={{ fontSize: 10, color: '#A8A29E', marginTop: 2 }}>
            {subtitle}
          </p>
        </div>

        <div style={{
          width: 260, margin: '0 22px',
          position: 'relative', display: 'flex', alignItems: 'center',
        }}>
          <Search size={14} strokeWidth={1.8} style={{ position: 'absolute', left: 13, color: '#8F8A82', pointerEvents: 'none' }} />
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setActiveCategory(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchQuery('');
            }}
            placeholder="搜索"
            aria-label="搜索收藏"
            style={{
              width: '100%', height: 34, padding: '0 13px 0 36px',
              borderRadius: 13, border: '1px solid rgba(73,56,28,0.07)',
              background: 'rgba(253,252,250,0.58)',
              color: '#454248', fontSize: 12,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {([
            ['extension', '插件', Puzzle],
            ['agent', 'Agent', Bot],
          ] as const).map(([panel, label, Icon]) => (
            <motion.button
              key={panel}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => void openSetupPanel(panel)}
              style={{
                height: 36, padding: '0 13px', borderRadius: 15,
                border: '1px solid rgba(73,56,28,0.07)',
                background: 'rgba(253,252,250,0.78)', color: '#666159',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11.5, fontWeight: 550, cursor: 'pointer',
                boxShadow: '0 3px 13px rgba(73,56,28,0.045)',
              }}
            >
              <Icon size={14} strokeWidth={1.8} />
              {label}
            </motion.button>
          ))}
        </div>
      </header>

      <AnimatePresence>
        {setupPanel && (
          <SetupDialog
            panel={setupPanel}
            info={setupInfo}
            loading={setupLoading}
            message={setupMessage}
            connectingClient={connectingClient}
            connectedClients={connectedClients}
            onClose={() => setSetupPanel(null)}
            onOpenExtension={() => void handleOpenExtensionSetup()}
            onConnectAgent={(client) => void handleConnectAgent(client)}
          />
        )}
      </AnimatePresence>

      {/* ── Desk canvas ── */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: isEmpty || hasNoSearchResults ? 'calc(100vh - 98px)' : containerH,
        minHeight: isEmpty || hasNoSearchResults ? 520 : undefined,
        zIndex: 1,
      }}>
        {isEmpty && !state.isLoading && (
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
              color: '#77736C',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <BookMarked size={26} strokeWidth={1.4} color="#829987" />
            <div style={{
              marginTop: 12,
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 22,
              fontWeight: 600,
              color: '#4B494F',
            }}>
              把一条笔记拖进来
            </div>
            <div style={{ marginTop: 7, fontSize: 12 }}>
              松开后会自动保存图片、识别文字、分析并放进卡片分组
            </div>
          </motion.div>
        )}
        {hasNoSearchResults && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: '#77736C', textAlign: 'center', pointerEvents: 'none',
            }}
          >
            <Search size={24} strokeWidth={1.4} color="#829987" />
            <div style={{
              marginTop: 12, fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 20, fontWeight: 600, color: '#4B494F',
            }}>
              没找到相关收藏
            </div>
          </motion.div>
        )}
        <AnimatePresence>
          {draggedNoteId && labels
            .filter(({ groupId }) => groupId !== draggedNoteGroupId)
            .map(({ groupId, x, y, color }) => {
              const isDropTarget = dropTargetGroupId === groupId;
              return (
                <motion.div
                  key={`drop-zone-${groupId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDropTargetGroupId(groupId);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    if (dropTargetGroupId !== groupId) setDropTargetGroupId(groupId);
                  }}
                  onDragLeave={(event) => {
                    const nextTarget = event.relatedTarget;
                    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
                    if (dropTargetGroupId === groupId) setDropTargetGroupId(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleMoveNoteToGroup(draggedNoteId, groupId);
                    setDraggedNoteId(null);
                  }}
                  style={{
                    position: 'absolute',
                    left: x + 30 - groupDropZoneWidth / 2,
                    top: y - 14,
                    width: groupDropZoneWidth,
                    height: 330,
                    zIndex: 550,
                    borderRadius: 30,
                    border: `1px dashed ${isDropTarget ? `${color}88` : 'rgba(130,153,135,0.25)'}`,
                    background: isDropTarget ? `${color}12` : 'rgba(253,252,250,0.04)',
                    boxShadow: isDropTarget ? `inset 0 0 0 1px ${color}18` : 'none',
                    pointerEvents: 'auto',
                  }}
                />
              );
            })}
        </AnimatePresence>
        <AnimatePresence>
          {labels.map(({ groupId, name, x, y, color, kind, noteCount }) => {
            const isExpanded = activeCategory === groupId;
            const isEditing = editingGroupId === groupId;
            const isDropTarget = dropTargetGroupId === groupId;
            return (
              <motion.div
                key={`lbl-${groupId}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  transform: 'translateX(-50%)',
                  zIndex: isExpanded ? 600 : (activeCategory === null ? 400 : 100),
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <motion.div
                    onClick={() => {
                      if (isEditing) return;
                      setActiveCategory((prev) => (prev === groupId ? null : groupId));
                    }}
                    onDragOver={(event) => {
                      if (!draggedNoteId) return;
                      event.preventDefault();
                      if (dropTargetGroupId !== groupId) {
                        setDropTargetGroupId(groupId);
                      }
                    }}
                    onDragLeave={() => {
                      if (dropTargetGroupId === groupId) {
                        setDropTargetGroupId(null);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedNoteId) {
                        handleMoveNoteToGroup(draggedNoteId, groupId);
                      }
                      setDraggedNoteId(null);
                    }}
                    style={{
                      background: isExpanded || isDropTarget ? 'rgba(253, 252, 250, 0.98)' : 'rgba(240, 238, 230, 0.85)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      padding: '6px 14px 6px 18px',
                      borderRadius: 24,
                      border: isExpanded || isDropTarget ? `1px solid ${color}40` : '1px solid rgba(0,0,0,0.04)',
                      boxShadow: isExpanded || isDropTarget
                        ? `0 8px 24px ${color}25, 0 2px 8px rgba(0,0,0,0.06)`
                        : '0 2px 8px rgba(55,45,25,0.08)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    animate={isDropTarget ? { scale: 1.05, y: -2 } : { scale: 1, y: 0 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    {isEditing ? (
                      <>
                        <input
                          value={editingGroupName}
                          onChange={(event) => setEditingGroupName(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleCommitRename();
                            }
                            if (event.key === 'Escape') {
                              setEditingGroupId(null);
                              setEditingGroupName('');
                            }
                          }}
                          autoFocus
                          style={{
                            width: 132,
                            height: 30,
                            border: '1px solid rgba(0,0,0,0.08)',
                            borderRadius: 10,
                            background: '#fff',
                            padding: '0 10px',
                            fontSize: 13,
                            color: '#3A3840',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCommitRename();
                          }}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 999,
                            border: 'none',
                            background: color,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Check size={13} strokeWidth={2.2} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div>
                          <div style={{ position: 'relative', fontFamily: 'Playfair Display, Georgia, serif', fontSize: 15, fontWeight: 600, color: isExpanded ? color : '#3A3840', zIndex: 1 }}>
                            {name}
                            <div style={{
                              position: 'absolute',
                              bottom: 2,
                              left: -2,
                              right: -2,
                              height: 6,
                              background: color,
                              opacity: isExpanded ? 0.1 : 0.35,
                              zIndex: -1,
                              borderRadius: 2,
                              transition: 'opacity 0.3s ease',
                            }} />
                          </div>
                          <div style={{ marginTop: 2, fontSize: 10, color: '#A8A29E', lineHeight: 1 }}>
                            {kind === 'inbox' ? '新进笔记' : `${noteCount} 条笔记`}
                          </div>
                        </div>
                        <motion.div
                          animate={{
                            rotate: isExpanded ? 180 : 0,
                            color: isExpanded ? color : '#A8A29E'
                          }}
                          transition={{ type: 'spring', stiffness: 250, damping: 20 }}
                          style={{ display: 'flex', alignItems: 'center' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </motion.div>
                      </>
                    )}
                  </motion.div>

                  <AnimatePresence>
                    {isExpanded && (
                      <>
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.8, x: -10 }}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleStartRename(groupId, name);
                          }}
                          style={{
                            background: 'rgba(253,252,250,0.94)',
                            color: '#6B6860',
                            border: '1px solid rgba(0,0,0,0.06)',
                            borderRadius: 20,
                            width: 34,
                            height: 34,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(73,56,28,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Pencil size={14} strokeWidth={1.8} />
                        </motion.button>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Cards */}
        {visibleNotes.map(note => {
          const pos = positions[note.id];
          if (!pos) return null;
          const noteGroupId = deskState.noteGroupMap?.[note.id] || 'inbox';
          const isDimmed = activeCategory !== null && noteGroupId !== activeCategory;
          return (
            <DeskCard
              key={note.id}
              note={note}
              pos={pos}
              isDimmed={isDimmed}
              lightweight={lightweightCanvas}
              onClick={() => setExpanded(note)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          );
        })}
      </div>

      {/* ── Expanded overlay ── */}
      <AnimatePresence>
        {expanded && (
          <ExpandedCard
            key={expanded.id}
            note={expanded}
            onClose={() => setExpanded(null)}
            onDelete={() => void handleDeleteNote(expanded)}
            isDeleting={deletingNoteId === expanded.id}
          />
        )}
      </AnimatePresence>

      {/* ── Bottom floating controls ── */}
      {!state.isLoading && notes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'fixed',
            bottom: 24,
            left: 0,
            right: 0,
            zIndex: 90,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleCreateGroup}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 500,
              color: '#FDFCFA',
              background: '#829987',
              border: '1px solid #829987',
              borderRadius: 24,
              padding: '10px 20px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              boxShadow: '0 4px 20px rgba(55,45,25,0.12), 0 2px 8px rgba(0,0,0,0.08)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <Plus size={16} />
            新建分组
          </motion.button>
        </motion.div>
      )}

    </div>
  );
}
