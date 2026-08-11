import { spawn } from 'node:child_process';

const NEXT_PORT = '1420';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [];
let shuttingDown = false;

function spawnProcess(label, args, env = {}) {
  const child = spawn(npmCommand, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env,
    },
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code !== 0) {
      console.error(`${label} exited with code ${code ?? 'unknown'}`);
    } else if (signal) {
      console.error(`${label} exited due to signal ${signal}`);
    }

    shutdown(code ?? 0);
  });

  children.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 150);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function isUrlReachable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const nextReady = await isUrlReachable(`http://127.0.0.1:${NEXT_PORT}`);

  console.log(`desktop preview starting at http://localhost:${NEXT_PORT}`);

  if (nextReady) {
    console.log(`reusing next dev server on port ${NEXT_PORT}`);
  } else {
    spawnProcess('next-dev', ['run', 'dev', '--', '--port', NEXT_PORT]);
  }
}

await main();
