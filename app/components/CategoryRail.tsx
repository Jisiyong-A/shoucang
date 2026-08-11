'use client';

import { Plus, X } from 'lucide-react';
import { useRef } from 'react';
import type { DragEvent } from 'react';

export type RailGroup = {
  id: string;
  name: string;
  kind: 'inbox' | 'custom';
  noteCount: number;
};

export function CategoryRail({
  groups,
  activeCategory,
  searchActive,
  draggedNoteId,
  dropTargetGroupId,
  onSelect,
  onCreate,
  onDropNote,
  onRenameCommit,
  onStartRename,
  editingGroupId,
  editingGroupName,
  setEditingGroupName,
}: {
  groups: RailGroup[];
  activeCategory: string | null;
  searchActive: boolean;
  draggedNoteId: string | null;
  dropTargetGroupId: string | null;
  onSelect: (groupId: string | null) => void;
  onCreate: () => void;
  onDropNote: (noteId: string, groupId: string) => void;
  onRenameCommit: () => void;
  onStartRename: (groupId: string, name: string) => void;
  editingGroupId: string | null;
  editingGroupName: string;
  setEditingGroupName: (value: string) => void;
}) {
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (event: DragEvent<HTMLDivElement>, groupId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (draggedNoteId) onDropNote(draggedNoteId, groupId);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 20px',
        overflowX: 'auto',
        borderBottom: '1px solid var(--line)',
        background: 'rgba(0,0,0,0.6)',
        position: 'sticky',
        top: 73,
        zIndex: 90,
        scrollbarWidth: 'none',
      }}
    >
      {searchActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '6px 12px',
            borderRadius: 7,
            border: '1px solid var(--signal)',
            background: 'var(--signal-soft)',
            color: 'var(--signal)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}
        >
          搜索中
          <X
            size={12}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }}
          />
        </div>
      )}

      {groups.map((group) => {
        const active = activeCategory === group.id;
        const isDropTarget = dropTargetGroupId === group.id;
        const isEditing = editingGroupId === group.id;
        const inbox = group.kind === 'inbox';

        return (
          <div
            key={group.id}
            onDragOver={(event) => {
              if (!draggedNoteId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => handleDrop(event, group.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 6px 6px 12px',
              borderRadius: 7,
              border: `1px solid ${active || isDropTarget ? 'var(--line-strong)' : 'var(--line)'}`,
              background: active || isDropTarget ? 'var(--surface-3)' : 'var(--surface)',
              color: active ? 'var(--text)' : 'var(--text-dim)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'border-color 0.15s ease, background 0.15s ease',
            }}
            onClick={() => {
              if (isEditing) return;
              onSelect(active ? null : group.id);
            }}
            onMouseEnter={(e) => {
              if (!active && !isDropTarget) {
                e.currentTarget.style.borderColor = 'var(--line-strong)';
                e.currentTarget.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (!active && !isDropTarget) {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.color = 'var(--text-dim)';
              }
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 1.5,
                background: inbox ? 'var(--signal)' : 'var(--text-faint)',
                flexShrink: 0,
              }}
            />
            {isEditing ? (
              <input
                ref={renameInputRef}
                value={editingGroupName}
                onChange={(event) => setEditingGroupName(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onRenameCommit();
                  }
                  if (event.key === 'Escape') onRenameCommit();
                }}
                autoFocus
                style={{
                  width: 110,
                  height: 24,
                  border: '1px solid var(--line-strong)',
                  borderRadius: 4,
                  background: '#000',
                  color: 'var(--text)',
                  padding: '0 8px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            ) : (
              <>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{group.name}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-faint)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {group.noteCount}
                </span>
              </>
            )}
            {active && !inbox && !isEditing && (
              <button
                type="button"
                title="重命名"
                onClick={(event) => {
                  event.stopPropagation();
                  onStartRename(group.id, group.name);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-faint)',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: 2,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onCreate}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 7,
          border: '1px dashed var(--line-strong)',
          background: 'transparent',
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
      >
        <Plus size={12} />
        新建分组
      </button>
    </div>
  );
}
