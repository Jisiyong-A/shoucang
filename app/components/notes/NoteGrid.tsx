'use client';

import { motion } from 'framer-motion';
import { Note } from '../../types/xiaohongshu';
import { MatchSource } from '../search/SearchResultMeta';
import { NoteCard } from './NoteCard';

export function NoteGrid({
  notes,
  matchSources,
  activeFilter,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  notes: Note[];
  matchSources?: Record<string, MatchSource[]>;
  activeFilter: boolean;
  onOpen: (note: Note) => void;
  onDragStart: (noteId: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <motion.div
      layout
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(224px, 1fr))',
        gap: 14,
      }}
    >
      {notes.map((note, index) => (
        <NoteCard
          key={note.id}
          note={note}
          index={index}
          dimmed={activeFilter}
          matchSources={matchSources?.[note.id]}
          onClick={() => onOpen(note)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </motion.div>
  );
}
