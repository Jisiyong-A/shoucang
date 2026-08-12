/**
 * macOS platform adapter.
 * - data directory: ~/Library/Application Support/com.patrick.shoucang
 * - executable discovery: Homebrew /usr/local paths, then `command -v` via zsh
 * - open folder / open browser URL: `open`
 */
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { macosDataDirectory } from './common.mjs';

const execFileAsync = promisify(execFile);

export function dataDirectory(env = process.env) {
  return macosDataDirectory(env);
}

export function knownExecutableCandidates(client) {
  const home = os.homedir();
  if (client === 'codex') {
    return [
      '/opt/homebrew/bin/codex',
      '/usr/local/bin/codex',
      path.join(home, '.local', 'bin', 'codex'),
      path.join(home, '.npm-global', 'bin', 'codex'),
    ];
  }
  if (client === 'claude') {
    return [
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
      path.join(home, '.local', 'bin', 'claude'),
      path.join(home, '.claude', 'local', 'claude'),
    ];
  }
  return [];
}

export async function resolveExecutable(name, env = process.env) {
  const known = knownExecutableCandidates(name, env).find((candidate) => existsSync(candidate));
  if (known) return known;

  try {
    const { stdout } = await execFileAsync('/bin/zsh', ['-lc', `command -v ${name}`], {
      timeout: 5000,
      maxBuffer: 64 * 1024,
    });
    const resolved = stdout.trim();
    return resolved && existsSync(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

export function openFolder(folderPath) {
  const child = spawn('open', [folderPath], { detached: true, stdio: 'ignore' });
  child.unref();
}

export function openBrowserUrl(url) {
  const child = spawn('open', ['-a', 'Google Chrome', url], { detached: true, stdio: 'ignore' });
  child.unref();
  return true;
}
