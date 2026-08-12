'use client';

import { Bot, Check, Loader2 } from 'lucide-react';
import { AgentClient, LocalSetupInfo } from '../../lib/xhs-client';
import { Button, StatusLight } from '../ui';

export function AgentPanel({
  info,
  connectingClient,
  connectedClients,
  onConnectAgent,
  message,
}: {
  info: LocalSetupInfo | null;
  connectingClient: AgentClient | null;
  connectedClients: Set<AgentClient>;
  onConnectAgent: (client: AgentClient) => void;
  message: string;
}) {
  return (
    <div>
      <div style={{ borderTop: 'var(--border-hairline)' }}>
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
                minHeight: 58,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                borderBottom: 'var(--border-hairline)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <StatusLight state={detected ? 'ok' : 'idle'} />
                <strong style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{label}</strong>
              </div>
              <Button
                variant={connected ? 'ghost' : 'primary'}
                onClick={() => onConnectAgent(client)}
                disabled={!detected || connecting}
                size="sm"
              >
                {connecting ? <Loader2 size={13} className="animate-spin" /> : connected ? <Check size={13} /> : <Bot size={13} />}
                {connecting ? '连接中' : connected ? '已连接' : detected ? '连接' : '未安装'}
              </Button>
            </div>
          );
        })}
      </div>
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
