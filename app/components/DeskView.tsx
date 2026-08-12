/* 收藏 · SHOUCANG DOT/GRID UI — orchestrator
 * Three-layer shell: TitleBar / Sidebar+Workspace / StatusBar.
 * All state + side-effect logic lives here; presentational pieces live in
 * shell/, notes/, search/, import/, setup/, ui/.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AnimatePresence } from 'framer-motion';

import { Note } from '../types/xiaohongshu';
import { useNotes, useApp } from '../lib/store';
import {
  connectLocalAgent,
  deleteStoredNote,
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
import { filterNotesByQuery } from '../../scripts/lib/note-search.mjs';
import { hybridSearchNotes } from '../lib/semantic-search';
import {
  indexNotesInBackground,
  semanticIndexStatus,
  semanticSearchEmbedded,
} from '../lib/semantic-embed.mjs';
import {
  createDeskGroup,
  ensureDeskState,
  moveNoteToGroup,
  renameDeskGroup,
} from '../lib/desk-workspace.mjs';

import { DotMatrix } from './ui/DotMatrix';
import { TitleBar } from './shell/TitleBar';
import { Sidebar, RailGroup } from './shell/Sidebar';
import { TopNav } from './shell/TopNav';
import { MobileNavBar } from './shell/MobileNavBar';
import { useWindowSizeClass } from '../lib/use-window-size-class';
import { StatusBar } from './shell/StatusBar';
import { NoteGrid } from './notes/NoteGrid';
import { NoteDetail } from './notes/NoteDetail';
import { ImportDropzone, IDLE_IMPORT_FEEDBACK, ImportFeedback } from './import/ImportDropzone';
import { SetupPanel } from './setup/SetupPanel';
import { EmptyState } from './EmptyState';
import { findMatchSources, MatchSource } from './search/SearchResultMeta';
import { SetupPanel as SetupPanelType } from './DeskView.types';

// ── Helpers ────────────────────────────────────────────────────────────────

function getDraggedNoteTitle(input: string): string {
  const card = parseDraggedCardInput(input);
  if (card?.title) return card.title;
  const markerIndex = input.indexOf('SHOUCANG_NOTE:');
  if (markerIndex >= 0) {
    const afterMarker = input.slice(markerIndex + 'SHOUCANG_NOTE:'.length);
    const parts = afterMarker.split('|');
    return parts[1] || '笔记';
  }
  return input.slice(0, 48);
}

type DeskState = {
  groups?: Array<{ id: string; name: string; kind: 'inbox' | 'custom' }>;
  noteGroupMap?: Record<string, string>;
  knownNoteIds?: string[];
};

const IMPORT_STEP_DELAYS: Array<{ step: ImportFeedback['step']; afterMs: number }> = [
  { step: 'resolve', afterMs: 300 },
  { step: 'media', afterMs: 700 },
  { step: 'ocr', afterMs: 1500 },
  { step: 'index', afterMs: 2400 },
];

// ── Main view ──────────────────────────────────────────────────────────────

export function DeskView() {
  const { notes, setNotes } = useNotes();
  const { state, dispatch } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);

  const [deskState, setDeskState] = useState<DeskState>({ groups: [], noteGroupMap: {}, knownNoteIds: [] });
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Note | null>(null);
  const [serviceHealth, setServiceHealth] = useState<LocalServiceHealth>({ ok: false, source: 'sidecar' });
  const [healthChecked, setHealthChecked] = useState(false);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback>(IDLE_IMPORT_FEEDBACK);
  const [importDialog, setImportDialog] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [setupPanel, setSetupPanel] = useState<SetupPanelType | null>(null);
  const [setupInfo, setSetupInfo] = useState<LocalSetupInfo | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');
  const [connectingClient, setConnectingClient] = useState<AgentClient | null>(null);
  const [connectedClients, setConnectedClients] = useState<Set<AgentClient>>(() => new Set());

  const loadLocalStatus = useCallback(async () => {
    try {
      const health = await getLocalServiceHealth();
      setServiceHealth(health);
    } catch {
      setServiceHealth({ ok: false, source: 'sidecar' });
    } finally {
      setHealthChecked(true);
    }
  }, []);

  const openSetupPanel = async (panel: SetupPanelType) => {
    setSetupPanel(panel);
    setSetupMessage('');
    setSetupLoading(true);
    try {
      const [info, health] = await Promise.all([getLocalSetupInfo(), getLocalServiceHealth()]);
      setSetupInfo(info);
      setServiceHealth(health);
      setHealthChecked(true);
    } catch {
      setSetupInfo(null);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleOpenExtensionSetup = async (browser?: 'chrome' | 'edge') => {
    setSetupLoading(true);
    setSetupMessage('');
    try {
      const result = await openBrowserExtensionSetup(browser);
      setSetupMessage(result.message);
    } catch (error) {
      setSetupMessage(error instanceof Error && error.message ? error.message : '打开失败，请检查本地服务');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleConnectAgent = async (client: AgentClient) => {
    if (connectingClient) return;
    setConnectingClient(client);
    setSetupMessage('');
    try {
      const result = await connectLocalAgent(client);
      setSetupMessage(result.message);
      setConnectedClients((current) => {
        const next = new Set(current);
        next.add(client);
        return next;
      });
    } catch (error) {
      setSetupMessage(error instanceof Error && error.message ? error.message : '连接失败');
    } finally {
      setConnectingClient(null);
    }
  };

  const dismissImportFeedback = (phase: ImportFeedback['phase'], delay = 2800) => {
    window.setTimeout(() => {
      setImportFeedback((current) => current.phase === phase ? IDLE_IMPORT_FEEDBACK : current);
    }, delay);
  };

  useEffect(() => {
    void loadLocalStatus();
  }, [loadLocalStatus]);

  useEffect(() => {
    if (notes.length > 0) {
      setDeskState((prev) => ensureDeskState(prev, notes) as DeskState);
    }
  }, [notes]);

  // ── Embedded semantic index (local WASM model, background) ──
  const [semanticIndexed, setSemanticIndexed] = useState({ cached: 0, total: 0 });
  const [semanticHits, setSemanticHits] = useState<Note[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await semanticIndexStatus(notes);
        if (cancelled) return;
        setSemanticIndexed(status);
        if (status.cached < status.total) {
          await indexNotesInBackground(notes, {
            onProgress: (cached: number, total: number) => {
              if (!cancelled) setSemanticIndexed({ cached, total });
            },
          });
          if (!cancelled) setSemanticIndexed(await semanticIndexStatus(notes));
        }
      } catch {
        // model unavailable — TF-IDF search remains the fallback
      }
    })();
    return () => { cancelled = true; };
  }, [notes]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSemanticHits([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const hits = await semanticSearchEmbedded(notes, query);
        if (!cancelled && hits.length > 0) {
          setSemanticHits(hits.map((hit) => hit.note));
        } else if (!cancelled) {
          setSemanticHits([]);
        }
      } catch {
        if (!cancelled) setSemanticHits([]);
      }
    })();
    return () => { cancelled = true; };
  }, [searchQuery, notes]);

  // ── Derived data ──
  const baseSearchNotes = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return notes;
    // Hybrid: exact keyword hits first, then local TF-IDF semantic hits
    // (title/body/OCR/tags) so phrasing differences still find the note.
    return hybridSearchNotes(notes, query, (note) =>
      filterNotesByQuery([note], query, (n: Note) => n.rawContent || '').length > 0,
    );
  }, [notes, searchQuery]);

  const visibleNotes = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return notes;
    // Merge embedded-semantic hits (async) that the sync layer missed.
    if (semanticHits.length === 0) return baseSearchNotes;
    const seen = new Set(baseSearchNotes.map((note) => note.id));
    return [...baseSearchNotes, ...semanticHits.filter((note) => !seen.has(note.id))];
  }, [baseSearchNotes, semanticHits, searchQuery, notes]);

  const hasActiveSearch = searchQuery.trim().length > 0;

  const railGroups: RailGroup[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const note of notes) {
      const groupId = deskState.noteGroupMap?.[note.id] || 'inbox';
      counts[groupId] = (counts[groupId] || 0) + 1;
    }
    return (deskState.groups || [])
      .filter((group) => counts[group.id] !== undefined)
      .map((group) => ({
        id: group.id,
        name: group.name,
        kind: group.kind,
        noteCount: counts[group.id] || 0,
      }));
  }, [deskState.groups, deskState.noteGroupMap, notes]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const note of notes) {
      const name = note.category || '待分类';
      counts[name] = (counts[name] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [notes]);

  const ocrCount = useMemo(
    () => notes.filter((note) => Boolean((note.ocrText || '').trim())).length,
    [notes],
  );

  const filteredForGrid = useMemo(() => {
    if (hasActiveSearch) return visibleNotes;
    if (activeGroup !== null) {
      return visibleNotes.filter((note) => (deskState.noteGroupMap?.[note.id] || 'inbox') === activeGroup);
    }
    if (activeCategory !== null) {
      return visibleNotes.filter((note) => (note.category || '待分类') === activeCategory);
    }
    return visibleNotes;
  }, [hasActiveSearch, visibleNotes, activeGroup, activeCategory, deskState.noteGroupMap]);

  const matchSources = useMemo(() => {
    if (!hasActiveSearch) return undefined;
    const map: Record<string, MatchSource[]> = {};
    for (const note of visibleNotes) {
      const sources = findMatchSources(note, searchQuery);
      if (sources.length > 0) map[note.id] = sources;
    }
    return map;
  }, [hasActiveSearch, visibleNotes, searchQuery]);

  // ── Actions ──
  const runImport = async (value: string) => {
    const input = value.trim();
    if (!input || state.isLoading) return;

    if (!(serviceHealth.source === 'sidecar' && serviceHealth.ok)) {
      setImportFeedback({
        phase: 'error',
        step: 'error',
        title: '本地服务未连接',
        message: '请重新启动收藏后再试',
      });
      dismissImportFeedback('error');
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    setImportDialog(false);
    setImportFeedback({
      phase: 'recognized',
      step: 'capture',
      title: getDraggedNoteTitle(input),
      message: 'CAPTURE OK',
    });

    // progress the pipeline while the single import call runs
    const stepTimers = IMPORT_STEP_DELAYS.map(({ step, afterMs }) =>
      window.setTimeout(() => {
        setImportFeedback((current) => ({
          ...current,
          phase: 'processing',
          step,
          message: step === 'resolve'
            ? '正在匿名解析正文和图片…'
            : step === 'media'
              ? '正在下载图片…'
              : step === 'ocr'
                ? '正在本地 OCR…'
                : '正在建立索引…',
        }));
      }, afterMs),
    );
    let settled = false;
    const clearStepTimers = () => {
      if (settled) return;
      settled = true;
      stepTimers.forEach(window.clearTimeout);
    };

    try {
      const result = await importSharedNote(input);
      clearStepTimers();
      setNotes(result.notes);
      setImportFeedback({
        phase: 'complete',
        step: 'index',
        title: result.note.title,
        message: result.created ? '已收录' : '内容已更新',
      });
      await loadLocalStatus();
      window.setTimeout(() => {
        setImportFeedback((current) => current.phase === 'complete' ? IDLE_IMPORT_FEEDBACK : current);
      }, 1800);
    } catch (error) {
      clearStepTimers();
      const message = error instanceof Error && error.message ? error.message : '导入失败，请检查链接后重试';
      setImportFeedback({ phase: 'error', step: 'error', title: '没有收录成功', message });
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
      custom: event.dataTransfer.getData('application/x-shoucang-note')
        || event.dataTransfer.getData('application/x-shoucang-card'),
      plain: event.dataTransfer.getData('text/plain'),
      uriList: event.dataTransfer.getData('text/uri-list'),
      mozUrl: event.dataTransfer.getData('text/x-moz-url'),
    });
    if (input.trim()) {
      void runImport(input);
    } else {
      setImportFeedback({
        phase: 'error',
        step: 'error',
        title: '没有识别到笔记',
        message: '请直接拖动小红书搜索结果里的笔记卡片或封面',
      });
      dismissImportFeedback('error');
    }
  };

  const handleCreateGroup = () => {
    setDeskState((prev) => {
      const next = createDeskGroup(prev, '新分组') as DeskState;
      const created = next.groups?.find((group) => !prev.groups?.some((current) => current.id === group.id));
      if (created) {
        setActiveGroup(created.id);
        setActiveCategory(null);
        setEditingGroupId(created.id);
        setEditingGroupName(created.name);
      }
      return next;
    });
  };

  const handleCommitRename = () => {
    if (!editingGroupId) return;
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
        step: 'index',
        title: note.title,
        message: '已从收藏和本地图片中删除',
      });
      dismissImportFeedback('complete', 1800);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '删除失败，请重试';
      setImportFeedback({ phase: 'error', step: 'error', title: '没有删除成功', message });
      dismissImportFeedback('error', 3200);
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleDragEnd = useCallback(() => {
    setDraggedNoteId(null);
    setDropTargetGroupId(null);
  }, []);

  const canUseLocalService = serviceHealth.source === 'sidecar' && serviceHealth.ok;

  const wc = useWindowSizeClass();
  const isCompact = wc === 'compact';
  const mobileNavActive = 'library' as const;


  const isEmpty = notes.length === 0;
  const hasNoSearchResults = !isEmpty && hasActiveSearch && visibleNotes.length === 0;
  const groupFilterActive = activeGroup !== null || activeCategory !== null;

  return (
    <div
      ref={containerRef}
      onDragEnter={(event) => {
        if (!draggedNoteId && acceptsExternalNoteDrag(event.dataTransfer.types)) {
          event.preventDefault();
          setImportFeedback({ phase: 'dragging', step: 'idle', title: '松手收录', message: '' });
        }
      }}
      onDragOver={(event) => {
        if (!draggedNoteId && acceptsExternalNoteDrag(event.dataTransfer.types)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          if (importFeedback.phase === 'idle') {
            setImportFeedback({ phase: 'dragging', step: 'idle', title: '松手收录', message: '' });
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
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        position: 'relative',
      }}
    >
      <DotMatrix
        size="sparse"
        ariaHidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 'var(--z-dot-field)',
        }}
      />

      {/* Import overlay (dropzone + 5-step pipeline) */}
      <ImportDropzone feedback={importFeedback} draggedNoteId={draggedNoteId} onDrop={handleExternalDrop} />

      {/* Layer 1: title / status bar */}
      <TitleBar
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setActiveGroup(null);
          setActiveCategory(null);
        }}
        health={serviceHealth}
        onOpenSetup={(panel) => void openSetupPanel(panel)}
        onImportClick={() => setImportDialog(true)}
        importing={state.isLoading}
        compact={isCompact}
      />

      {/* Import dialog (paste link) */}
      <AnimatePresence>
        {importDialog && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 'var(--z-setup)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)',
              padding: 24,
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setImportDialog(false);
            }}
          >
            <div
              role="dialog"
              aria-label="导入笔记"
              style={{
                width: 'min(460px, 100%)',
                borderRadius: 'var(--radius-6)',
                border: 'var(--border-strong)',
                background: 'var(--surface)',
                padding: 18,
              }}
            >
              <h3 style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.14em' }}>
                IMPORT NOTE
              </h3>
              <input
                autoFocus
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runImport(importUrl);
                  if (e.key === 'Escape') setImportDialog(false);
                }}
                placeholder="粘贴小红书笔记链接"
                aria-label="笔记链接"
                style={{
                  width: '100%',
                  marginTop: 12,
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 'var(--radius-3)',
                  border: 'var(--border-strong)',
                  background: '#000',
                  color: 'var(--text)',
                  fontSize: 12.5,
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setImportDialog(false)}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 'var(--radius-3)',
                    border: 'var(--border-hairline)',
                    background: 'transparent',
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void runImport(importUrl)}
                  disabled={!importUrl.trim()}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 'var(--radius-3)',
                    border: '1px solid var(--text)',
                    background: importUrl.trim() ? 'var(--text)' : 'var(--surface-3)',
                    color: importUrl.trim() ? 'var(--text-inverse)' : 'var(--text-faint)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: importUrl.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  导入
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Layer 2: top navigation (XHS-style) + full-width workspace */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TopNav
          groups={railGroups}
          categories={categories}
          activeGroup={activeGroup}
          activeCategory={activeCategory}
          searchActive={hasActiveSearch}
          draggedNoteId={draggedNoteId}
          dropTargetGroupId={dropTargetGroupId}
          onSelectGroup={setActiveGroup}
          onSelectCategory={setActiveCategory}
          onCreateGroup={handleCreateGroup}
          onDropNote={handleMoveNoteToGroup}
          onRenameCommit={handleCommitRename}
          onStartRename={(groupId, name) => {
            setEditingGroupId(groupId);
            setEditingGroupName(name);
          }}
          editingGroupId={editingGroupId}
          editingGroupName={editingGroupName}
          setEditingGroupName={setEditingGroupName}
        />

        {/* Main collection workspace */}
        <main
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: 'auto',
            padding: isCompact ? '12px 12px 88px' : '20px 20px 96px',
          }}
        >
          {isEmpty && !state.isLoading && <EmptyState />}
          {hasNoSearchResults && <EmptyState noResults />}

          {filteredForGrid.length > 0 && (
            <NoteGrid
              notes={filteredForGrid}
              matchSources={matchSources}
              activeFilter={groupFilterActive && !hasActiveSearch}
              onOpen={setExpanded}
              onDragStart={(noteId) => setDraggedNoteId(noteId)}
              onDragEnd={handleDragEnd}
            />
          )}

          {filteredForGrid.length === 0 && !isEmpty && !hasNoSearchResults && (
            <div
              style={{
                padding: '80px 0',
                textAlign: 'center',
                color: 'var(--text-faint)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.14em',
              }}
            >
              NO ITEMS
            </div>
          )}
        </main>
      </div>

      {/* Layer 3: engine / import status (hidden on compact; mobile nav shows instead) */}
      {!isCompact && (
        <StatusBar
          health={serviceHealth}
          noteCount={notes.length}
          ocrCount={ocrCount}
          onOpenSetup={() => void openSetupPanel('settings')}
        />
      )}

      {/* Mobile bottom navigation (Window Size Class compact, Material 3) */}
      {isCompact && (
        <MobileNavBar
          active={mobileNavActive}
          onLibrary={() => {
            setSearchQuery('');
            setActiveGroup(null);
            setActiveCategory(null);
            containerRef.current?.scrollTo({ top: 0 });
          }}
          onSearch={() => {
            const input = document.querySelector<HTMLInputElement>('input[aria-label="搜索收藏"]');
            input?.focus();
            input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          onSystem={() => void openSetupPanel('settings')}
        />
      )}

      {/* Detail overlay */}
      <AnimatePresence>
        {expanded && (
          <NoteDetail
            key={expanded.id}
            note={expanded}
            onClose={() => setExpanded(null)}
            onDelete={() => void handleDeleteNote(expanded)}
            isDeleting={deletingNoteId === expanded.id}
          />
        )}
      </AnimatePresence>

      {/* Setup dialog */}
      <AnimatePresence>
        {setupPanel && (
          <SetupPanel
            health={serviceHealth}
            info={setupInfo}
            loading={setupLoading}
            message={setupMessage}
            connectingClient={connectingClient}
            connectedClients={connectedClients}
            onClose={() => setSetupPanel(null)}
            onOpenExtension={(browser) => void handleOpenExtensionSetup(browser)}
            onConnectAgent={(client) => void handleConnectAgent(client)}
            onRecheck={() => void openSetupPanel(setupPanel)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
