'use client';

import { Bot, Check, ClipboardCopy, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { AgentClient, LocalSetupInfo } from '../../lib/xhs-client';
import { Button, MatrixLabel, StatusLight } from '../ui';

const CLIENT_LABELS: Array<[AgentClient, string]> = [
  ['hermes', 'HERMES'],
  ['codex', 'CODEX'],
  ['claude', 'CLAUDE CODE'],
];

export function AgentPanel({
  info,
  connectingClient,
  connectedClients,
  onConnectAgent,
  onRepairAgent,
  message,
}: {
  info: LocalSetupInfo | null;
  connectingClient: AgentClient | null;
  connectedClients: Set<AgentClient>;
  onConnectAgent: (client: AgentClient) => void;
  onRepairAgent: (client: AgentClient) => void;
  message: string;
}) {
  const [manualCopied, setManualCopied] = useState(false);
  const manual = info?.agent.manualConfig;

  const copyManualConfig = async () => {
    if (!manual) return;
    const text = [
      `# ${manual.name} — manual MCP config`,
      `command: ${manual.command}`,
      `args: ${manual.args.join(' ')}`,
      ...Object.entries(manual.env).map(([k, v]) => `env: ${k}=${v}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setManualCopied(true);
      setTimeout(() => setManualCopied(false), 1800);
    } catch {
      // clipboard unavailable (webview context) — show inline instead
      setManualCopied(false);
    }
  };

  return (
    <div>
      <div style={{ borderTop: 'var(--border-hairline)' }}>
        {CLIENT_LABELS.map(([client, label]) => {
          const detected = info?.agent.clients[client]?.available;
          const connected = Boolean(connectedClients.has(client) || info?.agent.clients[client]?.connected);
          const connecting = connectingClient === client;
          const state = !detected ? 'error' : connected ? 'ok' : 'idle';
          return (
            <div
              key={client}
              style={{
                minHeight: 58,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                borderBottom: 'var(--border-hairline)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <StatusLight state={state} />
                <strong style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                  {label}
                </strong>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: connected ? 'var(--success)' : detected ? 'var(--text-faint)' : 'var(--accent)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {connected ? 'CONNECTED' : detected ? 'AVAILABLE' : 'NOT FOUND'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Button
                  variant={connected ? 'ghost' : 'primary'}
                  onClick={() => onConnectAgent(client)}
                  disabled={!detected || connecting}
                  size="sm"
                >
                  {connecting ? <Loader2 size={13} className="animate-spin" /> : connected ? <Check size={13} /> : <Bot size={13} />}
                  {connecting ? '连接中' : connected ? '已连接' : 'CONNECT'}
                </Button>
                <Button
                  onClick={() => onRepairAgent(client)}
                  disabled={!detected || connecting}
                  size="sm"
                  title="重新注册 MCP（覆盖旧配置）"
                >
                  <RefreshCw size={12} />
                  REPAIR
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {manual && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 'var(--radius-3)',
            border: 'var(--border-hairline)',
            background: '#0D0D0F',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <MatrixLabel style={{ fontSize: 10 }}>MANUAL CONFIG</MatrixLabel>
            <Button size="sm" onClick={copyManualConfig} disabled={!manual}>
              {manualCopied ? <Check size={11} /> : <ClipboardCopy size={11} />}
              {manualCopied ? '已复制' : 'COPY'}
            </Button>
          </div>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              lineHeight: 1.7,
              color: 'var(--text-dim)',
            }}
          >
            {`${manual.command} ${manual.args.join(' ')}`}
          </pre>
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: 12,
            color: message.includes('失败') || message.includes('没有') ? 'var(--accent)' : 'var(--success)',
            fontSize: 11.5,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
