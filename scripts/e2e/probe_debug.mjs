/* Replicate the sidecar probe exactly, printing errors. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as platform from '../platform/index.mjs';

const execFileAsync = promisify(execFile);

const exe = await platform.resolveAgentExecutable('hermes');
console.log('resolved hermes:', exe);
if (!exe) process.exit(1);
try {
  const { stdout } = await execFileAsync(exe, ['mcp', 'list'], { timeout: 8000, maxBuffer: 1024 * 1024 });
  console.log('OK contains shoucang-notes:', stdout.includes('shoucang-notes'));
} catch (err) {
  console.log('FAILED:', err.message.slice(0, 300));
}
