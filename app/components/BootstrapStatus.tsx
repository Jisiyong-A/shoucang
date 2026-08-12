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
          setDetail(String(error).includes('__TAURI_INTERNALS__')
            ? '未检测到 Tauri 运行时（浏览器开发模式）'
            : String(error));
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
        bottom: 12,
        right: 12,
        zIndex: 9999,
        padding: '8px 12px',
        borderRadius: 12,
        background: 'rgba(0,0,0,0.82)',
        color: coreReady ? '#7CFC98' : '#D71921',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        lineHeight: 1.4,
        maxWidth: 320,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
      title={detail}
    >
      {status}
    </div>
  );
}
