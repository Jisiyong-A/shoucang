/**
 * TopNav — XHS-style horizontal navigation replacing the large sidebar.
 *
 * One row under the title bar: ALL · group chips · category chips.
 * Chips scroll horizontally when overflowing; groups accept note drops.
 */

import { useState, type DragEvent, type ReactNode } from 'react';
import { DotMatrix } from '../ui';
import type { RailGroup } from './Sidebar';

export function TopNav({
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
  const [groupSection, setGroupSection] = useState<'all' | 'group' | 'category'>('all');

  const chip = (
    active: boolean,
    onClick: () => void,
    label: string,
    count: number | null,
    dotColor?: string,
    dropTarget = false,
    onDrop?: (e: DragEvent<HTMLDivElement>) => void,
    extra?: ReactNode,
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
        gap: 7,
        padding: '6px 12px',
        borderRadius: '999px',
        border: `1px solid ${active || dropTarget ? 'var(--line-strong)' : 'var(--line)'}`,
        background: active || dropTarget ? 'var(--surface-3)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
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
        style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0 }}
      />
      {editingGroupId && label === editingGroupId ? (
        <input
          autoFocus
          value={editingGroupName}
          onChange={(e) => setEditingGroupName(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameCommit();
            if (e.key === 'Escape') onRenameCommit();
          }}
          style={{
            width: 90,
            background: 'var(--surface-2)',
            border: '1px solid var(--line-strong)',
            borderRadius: 6,
            color: 'var(--text)',
            fontSize: 12,
            padding: '2px 6px',
            outline: 'none',
          }}
        />
      ) : (
        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</span>
      )}
      {count !== null && (
        <span
          style={{
            fontSize: 10.5,
            color: active ? 'var(--text-dim)' : 'var(--text-faint)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {count}
        </span>
      )}
      {extra}
    </div>
  );

  const sectionDivider = (
    <div
      style={{
        width: 1,
        height: 18,
        background: 'var(--line)',
        flexShrink: 0,
        margin: '0 6px',
      }}
    />
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 16px',
        minHeight: 46,
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg)',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'thin',
        flexShrink: 0,
      }}
    >
      {/* ALL */}
      {chip(
        !searchActive && activeGroup === null && activeCategory === null,
        () => {
          setGroupSection('all');
          onSelectGroup(null);
          onSelectCategory(null);
        },
        'ALL',
        null,
      )}

      {sectionDivider}

      {/* GROUPS */}
      {chip(
        groupSection === 'group' && activeGroup === null && activeCategory === null,
        () => {
          setGroupSection('group');
          onSelectGroup(null);
          onSelectCategory(null);
        },
        'GROUPS',
        null,
      )}
      {groupSection === 'group' && (
        <>
          {groups.map((group) =>
            chip(
              activeGroup === group.id && groupSection === 'group',
              () => onSelectGroup(group.id),
              group.name,
              group.noteCount,
              group.color,
              dropTargetGroupId === group.id,
              (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedNoteId) onDropNote(draggedNoteId, group.id);
              },
            ),
          )}
          {chip(false, onCreateGroup, '+ NEW', null, undefined, false, undefined, undefined)}
        </>
      )}

      {sectionDivider}

      {/* CATEGORIES */}
      {chip(
        groupSection === 'category' && activeCategory === null,
        () => {
          setGroupSection('category');
          onSelectGroup(null);
          onSelectCategory(null);
        },
        'CATEGORIES',
        null,
      )}
      {groupSection === 'category' && (
        <>
          {categories.map((cat) =>
            chip(
              activeCategory === cat.name,
              () => onSelectCategory(cat.name),
              cat.name,
              cat.count,
            ),
          )}
        </>
      )}
    </div>
  );
}
