'use client';

export type ImportPhase = 'idle' | 'dragging' | 'recognized' | 'processing' | 'complete' | 'error';

export type ImportFeedback = {
  phase: ImportPhase;
  title: string;
  message: string;
};

export const IDLE_IMPORT_FEEDBACK: ImportFeedback = { phase: 'idle', title: '', message: '' };

export type SetupPanel = 'extension' | 'agent';
