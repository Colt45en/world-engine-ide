#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function spawnProc(name, args) {
  const child = spawn(npmCmd, args, {
    stdio: 'inherit',
    // On Windows, .cmd files require a shell to launch reliably.
    shell: isWin,
    env: process.env,
  });

  child.on('error', (err) => {
    console.error(`[brain-dev] Failed to start ${name}:`, err && err.message ? err.message : err);
  });

  return child;
}

function printHelp() {
  console.log(`Brain Dev Launcher

Starts:
- Brain relay (ws://localhost:9000)
- Vite UI (http://localhost:5173 or next free port)

Usage:
  npm run brain:dev

Notes:
- Ensure Python deps are installed (see brain/requirements.txt).
- This uses PYTHONPATH=brain/src via the brain:relay npm script.
`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

const relay = spawnProc('brain:relay', ['run', 'brain:relay']);
const ui = spawnProc('dev', ['run', 'dev']);

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    relay.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  try {
    ui.kill('SIGTERM');
  } catch {
    /* ignore */
  }

  // Give processes a moment to exit; then hard-exit.
  setTimeout(() => process.exit(code), 250).unref?.();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

relay.on('exit', (code) => {
  if (shuttingDown) return;
  // If relay dies, UI is not very useful for Brain-first workflows.
  shutdown(typeof code === 'number' ? code : 1);
});

ui.on('exit', (code) => {
  if (shuttingDown) return;
  // If UI exits, stop relay too.
  shutdown(typeof code === 'number' ? code : 1);
});
