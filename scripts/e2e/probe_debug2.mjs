/* Full copy of the sidecar probe logic, printing per-client results. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as platform from '../platform/index.mjs';

const execFileAsync = promisify(execFile);
const MCP_SERVER_NAME = 'shoucang-notes';

async function resolveAgentExecutable(client) {
  return platform.resolveAgentExecutable(client);
}

const probes = [
  ['codex', ['mcp', 'list']],
  ['claude', ['mcp', 'list', '--scope', 'user']],
  ['hermes', ['mcp', 'list']],
];
for (const [client, args] of probes) {
  try {
    const executable = await resolveAgentExecutable(client);
    if (!executable) { console.log(client, '-> no executable'); continue; }
    const { stdout } = await execFileAsync(executable, args, { timeout: 8000, maxBuffer: 1024 * 1024 });
    console.log(client, '-> stdout contains', JSON.stringify(MCP_SERVER_NAME), ':', stdout.includes(MCP_SERVER_NAME), '| bytes:', stdout.length);
  } catch (err) {
    console.log(client, '-> FAILED:', err.message.slice(0, 200));
  }
}
