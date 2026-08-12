'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Bootstrap status card (Task 03 §6).
 *
 * Calls the Tauri core commands and renders ANDROID CORE READY when the
 * native/core round trip works. Outside Tauri (plain browser / Next dev)
 * the invoke throws and the card degrades to a "web preview" note —
 * it never crashes the page.
 */
export function BootstrapStatus() {
  const [status, setStatus] = useState<string>('checking…');
  const [detail, setDetail] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const [platform, dataDir, statusText, health] = await Promise.all([
          invoke<string>('get_platform_info'),
          invoke<string>('get_app_data_dir'),
          invoke<string>('bootstrap_status'),
          invoke<string>('health'),
        ]);
        if (cancelled) return;
        setStatus(statusText);
        setDetail(`${platform} · ${health} · ${dataDir}`);
      } catch (error) {
        if (!cancelled) {
          setStatus('WEB PREVIEW');
          setDetail(String(error));
        }
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const coreReady = status.startsWith('ANDROID') || status.startsWith('DESKTOP');

  return (
    <div
      style={{
        position: 'fixed',
        top: 200,
        right: 16,
        zIndex: 99999,
        padding: '14px 20px',
        borderRadius: 16,
        background: coreReady ? 'rgba(0,180,80,0.9)' : 'rgba(215,25,33,0.92)',
        color: '#FFFFFF',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 16,
        fontWeight: 700,
        lineHeight: 1.4,
        maxWidth: 420,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
      title={detail}
    >
      {status}
    </div>
  );
}
