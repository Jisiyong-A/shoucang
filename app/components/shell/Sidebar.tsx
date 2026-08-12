'use client';

import { useState, type DragEvent } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { DotMatrix } from '../ui';

export type RailGroup = {
  id: string;
  name: string;
  kind: 'inbox' | 'custom';
  noteCount: number;
  color?: string;
};

export function Sidebar({
  groups,
  categories,
  activeGroup,
  activeCategory,
  searchActive,
  draggedNoteId,
  dropTargetGroupId,
  onSelectGroup,
  onSelectCategory,
  onCreateGroup,
  onDropNote,
  onRenameCommit,
  onStartRename,
  editingGroupId,
  editingGroupName,
  setEditingGroupName,
}: {
  groups: RailGroup[];
  categories: Array<{ name: string; count: number }>;
  activeGroup: string | null;
  activeCategory: string | null;
  searchActive: boolean;
  draggedNoteId: string | null;
  dropTargetGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onSelectCategory: (name: string | null) => void;
  onCreateGroup: () => void;
  onDropNote: (noteId: string, groupId: string) => void;
  onRenameCommit: () => void;
  onStartRename: (groupId: string, name: string) => void;
  editingGroupId: string | null;
  editingGroupName: string;
  setEditingGroupName: (value: string) => void;
}) {
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  const handleDrop = (event: DragEvent<HTMLDivElement>, groupId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (draggedNoteId) onDropNote(draggedNoteId, groupId);
  };

  const navItem = (
    active: boolean,
    onClick: () => void,
    label: string,
    count: number | null,
    dotColor?: string,
    extra?: React.ReactNode,
    dropTarget = false,
    onDrop?: (e: DragEvent<HTMLDivElement>) => void,
  ) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onDragOver={(e) => {
        if (draggedNoteId && onDrop) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={onDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '7px 10px',
        borderRadius: 'var(--radius-3)',
        border: `1px solid ${active || dropTarget ? 'var(--line-strong)' : 'transparent'}`,
        background: active || dropTarget ? 'var(--surface-3)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        cursor: 'pointer',
        outline: 'none',
        transition: `background var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out)`,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--text-dim)';
      }}
    >
      <DotMatrix
        size="dense"
        color={dotColor || (active ? 'var(--text)' : 'var(--text-faint)')}
        style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0 }}
      />
      <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {extra}
      {count !== null && (
        <span style={{ fontFamily: 'var(--font-dot)', fontSize: 14, color: 'var(--text-faint)' }}>
          {count}
        </span>
      )}
    </div>
  );

  const sectionHeader = (open: boolean, onToggle: () => void, label: string) => (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 4px 6px',
        background: 'none',
        border: 'none',
        color: 'var(--text-faint)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.2em',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <ChevronDown size={11} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform var(--motion-fast)' }} />
      {label}
    </button>
  );

  return (
    <aside
      aria-label="导航"
      style={{
        width: 212,
        flexShrink: 0,
        borderRight: 'var(--border-hairline)',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '10px 10px 16px',
        gap: 2,
      }}
    >
      {/* ALL */}
      {navItem(
        !searchActive && activeGroup === null && activeCategory === null,
        () => {
          onSelectGroup(null);
          onSelectCategory(null);
        },
        'ALL',
        null,
        'var(--text)',
      )}

      {searchActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            borderRadius: 'var(--radius-3)',
            border: '1px solid var(--accent)',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
          }}
        >
          SEARCHING…
        </div>
      )}

      {/* Groups (incl. custom, drag-drop targets) */}
      {sectionHeader(groupsOpen, () => setGroupsOpen((v) => !v), 'GROUPS')}
      {groupsOpen && groups.map((group) => {
        const active = activeGroup === group.id;
        const isEditing = editingGroupId === group.id;
        const inbox = group.kind === 'inbox';
        return navItem(
          active,
          () => {
            if (isEditing) return;
            onSelectGroup(active ? null : group.id);
            if (activeCategory !== null) onSelectCategory(null);
          },
          group.name,
          group.noteCount,
          inbox ? 'var(--accent)' : undefined,
          <>
            {isEditing ? (
              <input
                value={editingGroupName}
                onChange={(e) => setEditingGroupName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onRenameCommit(); }
                  if (e.key === 'Escape') onRenameCommit();
                }}
                autoFocus
                aria-label="分组名"
                style={{
                  width: 90,
                  height: 22,
                  border: 'var(--border-strong)',
                  borderRadius: 4,
                  background: '#000',
                  color: 'var(--text)',
                  fontSize: 11,
                  padding: '0 6px',
                  outline: 'none',
                }}
              />
            ) : null}
            {active && !inbox ? (
              <button
                type="button"
                title="重命名"
                aria-label="重命名分组"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRename(group.id, group.name);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-faint)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
            ) : null}
          </>,
          dropTargetGroupId === group.id,
          (e) => handleDrop(e, group.id),
        );
      })}
      <button
        type="button"
        onClick={onCreateGroup}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 'var(--radius-3)',
          border: '1px dashed var(--line-strong)',
          background: 'transparent',
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        <Plus size={11} />
        新建分组
      </button>

      {/* Auto categories */}
      {sectionHeader(categoriesOpen, () => setCategoriesOpen((v) => !v), 'CATEGORIES')}
      {categoriesOpen && categories.map((category) => navItem(
        activeCategory === category.name,
        () => {
          onSelectCategory(activeCategory === category.name ? null : category.name);
          if (activeGroup !== null) onSelectGroup(null);
        },
        category.name,
        category.count,
      ))}
    </aside>
  );
}
