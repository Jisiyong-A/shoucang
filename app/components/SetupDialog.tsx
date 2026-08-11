'use client';

import { motion } from 'framer-motion';
import { Bot, Check, ExternalLink, Loader2, X } from 'lucide-react';
import { AgentClient, LocalSetupInfo } from '../lib/xhs-client';
import { SetupPanel } from './DeskView.types';
import { Led, MatrixLabel } from './ui';

export function SetupDialog({
  panel,
  info,
  loading,
  message,
  connectingClient,
  connectedClients,
  onClose,
  onOpenExtension,
  onConnectAgent,
}: {
  panel: SetupPanel;
  info: LocalSetupInfo | null;
  loading: boolean;
  message: string;
  connectingClient: AgentClient | null;
  connectedClients: Set<AgentClient>;
  onClose: () => void;
  onOpenExtension: () => void;
  onConnectAgent: (client: AgentClient) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 310,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18 }}
        style={{
          width: 'min(440px, calc(100vw - 48px))',
          borderRadius: 14,
          background: '#0C0C0E',
          border: '1px solid var(--line-strong)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '22px 24px 22px', position: 'relative' }}>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 30,
              height: 30,
              borderRadius: 6,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>

          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: 'var(--text)',
            }}
          >
            {panel === 'extension' ? '浏览器插件' : '连接 Agent'}
          </h2>

          {loading ? (
            <div style={{ height: 132, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : panel === 'extension' ? (
            <div style={{ marginTop: 22 }}>
              <button
                onClick={onOpenExtension}
                disabled={!info?.extension.available}
                style={{
                  width: '100%',
                  height: 44,
                  border: 'none',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  background: info?.extension.available ? 'var(--text)' : 'var(--surface-3)',
                  color: info?.extension.available ? '#000' : 'var(--text-faint)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  cursor: info?.extension.available ? 'pointer' : 'not-allowed',
                  opacity: info?.extension.available ? 1 : 0.6,
                }}
              >
                <ExternalLink size={14} />
                打开扩展页与插件文件夹
              </button>
              <details style={{ marginTop: 14, color: 'var(--text-faint)' }}>
                <summary style={{ cursor: 'pointer', fontSize: 11.5, textAlign: 'center', listStylePosition: 'inside' }}>
                  安装帮助
                </summary>
                <div style={{ marginTop: 11, padding: '12px 14px', borderRadius: 8, background: '#0D0D0F', border: '1px solid var(--line)', fontSize: 11.5, lineHeight: 1.8 }}>
                  打开开发者模式，然后点「加载已解压的扩展程序」，选择刚打开的文件夹。
                </div>
              </details>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <div style={{ borderTop: '1px solid var(--line)' }}>
                {([
                  ['codex', 'Codex'],
                  ['claude', 'Claude Code'],
                ] as const).map(([client, label]) => {
                  const detected = info?.agent.clients[client]?.available;
                  const connected = connectedClients.has(client);
                  const connecting = connectingClient === client;
                  return (
                    <div
                      key={client}
                      style={{
                        minHeight: 62,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        borderBottom: '1px solid var(--line)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Led state={detected ? 'ok' : 'idle'} />
                        <strong style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{label}</strong>
                      </div>
                      <button
                        onClick={() => onConnectAgent(client)}
                        disabled={!detected || connecting}
                        style={{
                          width: 92,
                          height: 34,
                          borderRadius: 6,
                          border: connected ? '1px solid var(--ok)' : '1px solid var(--line)',
                          background: connected ? 'var(--ok-soft)' : detected ? 'var(--text)' : 'var(--surface-3)',
                          color: connected ? 'var(--ok)' : detected ? '#000' : 'var(--text-faint)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          letterSpacing: '0.05em',
                          cursor: detected && !connecting ? 'pointer' : 'default',
                          opacity: detected ? 1 : 0.5,
                        }}
                      >
                        {connecting ? <Loader2 size={13} className="animate-spin" /> : connected ? <Check size={13} /> : <Bot size={13} />}
                        {connecting ? '连接中' : connected ? '已连接' : detected ? '连接' : '未安装'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {message && (
            <div style={{ marginTop: 14, color: 'var(--ok)', fontSize: 11.5, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
              {message}
            </div>
          )}

          {info && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px dashed var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <MatrixLabel>数据目录</MatrixLabel>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-faint)',
                  wordBreak: 'break-all',
                }}
              >
                {info.agent.dataDirectory}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
