/* 看看收藏 · Windows redesign — dashboard / dot-geometry orchestrator
 * All state + side-effect logic lives here; presentational pieces are
 * extracted into: DashboardHeader, CategoryRail, NoteCard, NoteDetail,
 * ImportOverlay, SetupDialog, EmptyState, ui.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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
import {
  createDeskGroup,
  ensureDeskState,
  moveNoteToGroup,
  renameDeskGroup,
} from '../lib/desk-workspace.mjs';

import { DotField } from './ui';
import { DashboardHeader, SetupPanel } from './DashboardHeader';
import { CategoryRail, RailGroup } from './CategoryRail';
import { NoteCard } from './NoteCard';
import { NoteDetail } from './NoteDetail';
import { ImportOverlay } from './ImportOverlay';
import { SetupDialog } from './SetupDialog';
import { EmptyState } from './EmptyState';
import { IDLE_IMPORT_FEEDBACK, ImportFeedback } from './DeskView.types';

// ── Helpers ────────────────────────────────────────────────────────────────

function getDraggedNoteTitle(input: string): string {
  const card = parseDraggedCardInput(input);
  if (card?.title) return card.title;
  const markerIndex = input.indexOf('KANKAN_NOTE:');
  if (markerIndex >= 0) {
    const afterMarker = input.slice(markerIndex + 'KANKAN_NOTE:'.length);
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

// ── Main view ──────────────────────────────────────────────────────────────

export function DeskView() {
  const { notes, setNotes } = useNotes();
  const { state, dispatch } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);

  const [deskState, setDeskState] = useState<DeskState>({ groups: [], noteGroupMap: {}, knownNoteIds: [] });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Note | null>(null);
  const [serviceHealth, setServiceHealth] = useState<LocalServiceHealth>({ ok: false, source: 'sidecar' });
  const [healthChecked, setHealthChecked] = useState(false);
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
    try {
      const health = await getLocalServiceHealth();
      setServiceHealth(health);
    } catch {
      setServiceHealth({ ok: false, source: 'sidecar' });
    } finally {
      setHealthChecked(true);
    }
  };

  const openSetupPanel = async (panel: SetupPanel) => {
    setSetupPanel(panel);
    setSetupMessage('');
    setSetupLoading(true);
    try {
      setSetupInfo(await getLocalSetupInfo());
    } catch {
      setSetupInfo(null);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleOpenExtensionSetup = async () => {
    setSetupLoading(true);
    setSetupMessage('');
    try {
      const result = await openBrowserExtensionSetup();
      setSetupMessage(result.message);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '打开失败，请检查本地服务';
      setSetupMessage(message);
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
      const message = error instanceof Error && error.message ? error.message : '连接失败';
      setSetupMessage(message);
    } finally {
      setConnectingClient(null);
    }
  };

  const dismissImportFeedback = (phase: ImportFeedback['phase'], delay = 2800) => {
    window.setTimeout(() => {
      setImportFeedback((current) => current.phase === phase ? IDLE_IMPORT_FEEDBACK : current);
    }, delay);
  };

  // Init: health + desk state (once notes arrive)
  useEffect(() => {
    void loadLocalStatus();
  }, []);

  useEffect(() => {
    if (notes.length > 0) {
      setDeskState((prev) => ensureDeskState(prev, notes) as DeskState);
    }
  }, [notes]);

  // ── Derived data ──
  const visibleNotes = useMemo(
    () => filterNotesByQuery(notes, searchQuery.trim(), (note: Note) => note.rawContent || ''),
    [notes, searchQuery],
  );

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

  const ocrCount = useMemo(
    () => notes.filter((note) => Boolean((note.ocrText || '').trim())).length,
    [notes],
  );

  // ── Actions ──
  const runImport = async (value: string) => {
    const input = value.trim();
    if (!input || state.isLoading) return;
    const draggedCard = parseDraggedCardInput(input);

    if (!(serviceHealth.source === 'sidecar' && serviceHealth.ok)) {
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
      const message = error instanceof Error && error.message ? error.message : '导入失败，请检查链接后重试';
      setImportFeedback({ phase: 'error', title: '没有收录成功', message });
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
      const created = next.groups?.find((group) => !prev.groups?.some((current) => current.id === group.id));
      if (created) {
        setActiveCategory(created.id);
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

  const handleDragEnd = useCallback(() => {
    setDraggedNoteId(null);
    setDropTargetGroupId(null);
  }, []);

  const canUseLocalService = serviceHealth.source === 'sidecar' && serviceHealth.ok;

  const subtitle = state.error
    ? state.error
    : state.isLoading
      ? '加载中…'
      : !healthChecked
        ? 'LOCAL ENGINE · STARTING'
        : !canUseLocalService
          ? '本地服务离线'
          : hasActiveSearch
            ? `搜索 ${visibleNotes.length} 条`
            : `${notes.length} 条笔记`;

  const isEmpty = notes.length === 0;
  const hasNoSearchResults = !isEmpty && hasActiveSearch && visibleNotes.length === 0;
  const filteredForGrid = hasActiveSearch ? visibleNotes : (
    activeCategory ? visibleNotes.filter((note) => (deskState.noteGroupMap?.[note.id] || 'inbox') === activeCategory) : visibleNotes
  );

  return (
    <div
      ref={containerRef}
      onDragEnter={(event) => {
        if (!draggedNoteId && acceptsExternalNoteDrag(event.dataTransfer.types)) {
          event.preventDefault();
          setImportFeedback({ phase: 'dragging', title: '松手收录', message: '' });
        }
      }}
      onDragOver={(event) => {
        if (!draggedNoteId && acceptsExternalNoteDrag(event.dataTransfer.types)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          if (importFeedback.phase === 'idle') {
            setImportFeedback({ phase: 'dragging', title: '松手收录', message: '' });
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
        background: '#000',
        position: 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <DotField />

      {/* Import feedback overlay */}
      <ImportOverlay feedback={importFeedback} draggedNoteId={draggedNoteId} onDrop={handleExternalDrop} />

      {/* Header */}
      <DashboardHeader
        subtitle={subtitle}
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setActiveCategory(null);
        }}
        totalNotes={notes.length}
        groupCount={(deskState.groups || []).length}
        ocrCount={ocrCount}
        health={serviceHealth}
        onOpenSetup={(panel) => void openSetupPanel(panel)}
      />

      {/* Category rail */}
      {!isEmpty && (
        <CategoryRail
          groups={railGroups}
          activeCategory={activeCategory}
          searchActive={hasActiveSearch}
          draggedNoteId={draggedNoteId}
          dropTargetGroupId={dropTargetGroupId}
          onSelect={setActiveCategory}
          onCreate={handleCreateGroup}
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
      )}

      {/* Canvas / grid */}
      <div style={{ position: 'relative', zIndex: 1, padding: '22px 20px 96px' }}>
        {isEmpty && !state.isLoading && <EmptyState />}
        {hasNoSearchResults && <EmptyState noResults />}

        {filteredForGrid.length > 0 && (
          <motion.div
            layout
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(228px, 1fr))',
              gap: 14,
            }}
          >
            {filteredForGrid.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                dimmed={activeCategory !== null && (deskState.noteGroupMap?.[note.id] || 'inbox') !== activeCategory}
                onClick={() => setExpanded(note)}
                onDragStart={(noteId) => setDraggedNoteId(noteId)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </motion.div>
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
            该分组暂无笔记
          </div>
        )}
      </div>

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
    </div>
  );
}
