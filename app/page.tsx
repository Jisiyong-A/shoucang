'use client';

import { useEffect, useRef } from 'react';
import { DeskView } from './components/DeskView';
import { useApp } from './lib/store';
import { getNotes } from './lib/xhs-client';

export default function Home() {
  const { dispatch } = useApp();
  const notesSignatureRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    const load = async (showLoading = false) => {
      if (showLoading) dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const notes = await getNotes();
        if (cancelled) return;
        const signature = notes.map((note) => `${note.id}:${note.savedAt.getTime()}`).join('|');
        if (signature !== notesSignatureRef.current) {
          notesSignatureRef.current = signature;
          dispatch({ type: 'SET_NOTES', payload: notes });
        }
      } catch {
        if (!cancelled) dispatch({ type: 'SET_ERROR', payload: '加载失败' });
      } finally {
        if (showLoading && !cancelled) dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    void load(true);
    const intervalId = window.setInterval(() => void load(), 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [dispatch]); // dispatch is stable, no infinite loop

  return <DeskView />;
}
