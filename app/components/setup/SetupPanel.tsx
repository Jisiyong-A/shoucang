'use client';

import { motion } from 'framer-motion';
import { ExternalLink, X } from 'lucide-react';
import { AgentClient, LocalServiceHealth, LocalSetupInfo } from '../../lib/xhs-client';
import { Badge, Button, MatrixLabel, Panel, StatusLight } from '../ui';
import { AgentPanel } from './AgentPanel';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        padding: '10px 0',
        borderBottom: 'var(--border-hairline)',
      }}
    >
      <MatrixLabel>{label}</MatrixLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function SetupPanel({
  health,
  info,
  loading,
  message,
  connectingClient,
  connectedClients,
  onClose,
  onOpenExtension,
  onConnectAgent,
  onRecheck,
}: {
  health: LocalServiceHealth | null;
  info: LocalSetupInfo | null;
  loading: boolean;
  message: string;
  connectingClient: AgentClient | null;
  connectedClients: Set<AgentClient>;
  onClose: () => void;
  onOpenExtension: () => void;
  onConnectAgent: (client: AgentClient) => void;
  onRecheck: () => void;
}) {
  const ocr = health?.ocr;
  const ocrState = !ocr ? 'idle' : ocr.available ? 'ok' : 'error';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="设置"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-setup)',
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
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        style={{
          width: 'min(520px, calc(100vw - 48px))',
          maxHeight: '86vh',
          overflowY: 'auto',
          borderRadius: 'var(--radius-6)',
          background: 'var(--surface)',
          border: 'var(--border-strong)',
        }}
      >
        <div style={{ padding: '20px 22px', position: 'relative' }}>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-2)',
              border: 'var(--border-hairline)',
              background: 'var(--surface-2)',
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
            SYSTEM SETTINGS
          </h2>

          {loading ? (
            <div style={{ height: 132, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
              <Loader2Icon />
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              {/* LOCAL ENGINE */}
              <section aria-label="本地引擎">
                <MatrixLabel style={{ display: 'block', marginBottom: 4 }}>LOCAL ENGINE</MatrixLabel>
                <Panel radius="var(--radius-3)" style={{ padding: '2px 14px', marginBottom: 16 }}>
                  <Row label="STATUS">
                    <StatusLight state={health?.ok ? 'ok' : 'error'} blink={!health?.ok} />
                    <Badge tone={health?.ok ? 'ok' : 'error'}>
                      {health?.ok ? 'READY' : 'OFFLINE'}
                    </Badge>
                  </Row>
                  <Row label="PORT">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>127.0.0.1:4318</span>
                  </Row>
                </Panel>
              </section>

              {/* OCR ENGINE */}
              <section aria-label="OCR 引擎">
                <MatrixLabel style={{ display: 'block', marginBottom: 4 }}>OCR ENGINE</MatrixLabel>
                <Panel radius="var(--radius-3)" style={{ padding: '2px 14px', marginBottom: 16 }}>
                  <Row label="ENGINE">
                    <StatusLight state={ocrState} blink={ocrState === 'error' && Boolean(ocr)} />
                    <Badge tone={ocr?.available ? 'ok' : 'error'}>
                      {!ocr ? '—' : ocr.engine ? ocr.engine.toUpperCase() : 'UNSUPPORTED'}
                    </Badge>
                  </Row>
                  <Row label="LANGUAGES">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
                      {ocr?.languages?.length ? ocr.languages.join(', ') : '—'}
                    </span>
                  </Row>
                </Panel>
              </section>

              {/* DATA LOCATION */}
              <section aria-label="数据位置">
                <MatrixLabel style={{ display: 'block', marginBottom: 4 }}>DATA LOCATION</MatrixLabel>
                <Panel radius="var(--radius-3)" style={{ padding: '10px 14px', marginBottom: 16 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10.5,
                      color: 'var(--text-faint)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {health?.dataDirectory || info?.agent.dataDirectory || '—'}
                  </span>
                </Panel>
              </section>

              {/* BROWSER EXTENSION */}
              <section aria-label="浏览器插件">
                <MatrixLabel style={{ display: 'block', marginBottom: 4 }}>BROWSER EXTENSION</MatrixLabel>
                <Panel radius="var(--radius-3)" style={{ padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Badge tone={info?.extension.available ? 'ok' : 'error'}>
                      {info?.extension.available ? `v${info.extension.version || '?'} AVAILABLE` : 'NOT FOUND'}
                    </Badge>
                    <Button size="sm" onClick={onOpenExtension} disabled={!info?.extension.available}>
                      <ExternalLink size={12} />
                      打开设置
                    </Button>
                  </div>
                  <details style={{ marginTop: 10, color: 'var(--text-faint)' }}>
                    <summary style={{ cursor: 'pointer', fontSize: 11, listStylePosition: 'inside' }}>
                      安装帮助
                    </summary>
                    <div
                      style={{
                        marginTop: 8,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-2)',
                        background: '#0D0D0F',
                        border: 'var(--border-hairline)',
                        fontSize: 11,
                        lineHeight: 1.8,
                      }}
                    >
                      打开开发者模式，然后点「加载已解压的扩展程序」，选择打开的文件夹。
                    </div>
                  </details>
                </Panel>
              </section>

              {/* AGENT / MCP */}
              <section aria-label="Agent MCP">
                <MatrixLabel style={{ display: 'block', marginBottom: 4 }}>AGENT / MCP</MatrixLabel>
                <Panel radius="var(--radius-3)" style={{ padding: '2px 14px', marginBottom: 16 }}>
                  <AgentPanel
                    info={info}
                    connectingClient={connectingClient}
                    connectedClients={connectedClients}
                    onConnectAgent={onConnectAgent}
                    message={message}
                  />
                </Panel>
              </section>

              {/* ABOUT / LICENSE */}
              <section aria-label="关于">
                <MatrixLabel style={{ display: 'block', marginBottom: 4 }}>ABOUT</MatrixLabel>
                <Panel radius="var(--radius-3)" style={{ padding: '2px 14px' }}>
                  <Row label="VERSION">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>0.1.0-beta</span>
                  </Row>
                  <Row label="LICENSE">
                    <Badge>AGPL-3.0-or-later</Badge>
                  </Row>
                </Panel>
              </section>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <Button size="sm" onClick={onRecheck}>重新检查</Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Loader2Icon() {
  return (
    <span className="dot-pulse" style={{ width: 20, height: 20, borderRadius: 3, background: 'var(--text-dim)' }} />
  );
}
