/* eslint-disable no-console */

const { spawn } = require('node:child_process');
const net = require('node:net');

function spawnCmd(command, label) {
  const child = spawn(command, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  child.on('exit', (code) => {
    // If one child exits, we exit too.
    if (code && code !== 0) {
      process.exitCode = code;
    }
    console.log(`${label} exited (${code ?? 'unknown'})`);
    process.exit(process.exitCode ?? 0);
  });

  return child;
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const done = (open) => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(open);
    };

    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(250, () => done(false));
  });
}

async function main() {
  console.log('Starting full server: dist SPA + Brain relay…');
  console.log(' - UI:    http://127.0.0.1:4173/');
  console.log(' - Relay: ws://127.0.0.1:9001/');
  console.log(
    'Tip: open once with ?brainRelayUrl=ws://127.0.0.1:9001 to enable Brain-gated routes.',
  );

  const host = '127.0.0.1';

  const distPort = 4173;
  const relayPort = 9001;

  const distAlready = await isPortOpen(host, distPort);
  const relayAlready = await isPortOpen(host, relayPort);

  const dist = distAlready ? null : spawnCmd('npm run -s serve:dist', '[serve:dist]');
  if (distAlready) console.log(`[serve:dist] already running on ${host}:${distPort}`);

  const relay = relayAlready ? null : spawnCmd('npm run -s brain:relay', '[brain:relay]');
  if (relayAlready) console.log(`[brain:relay] already running on ${host}:${relayPort}`);

  const shutdown = () => {
    try {
      dist?.kill('SIGINT');
    } catch {
      // ignore
    }
    try {
      relay?.kill('SIGINT');
    } catch {
      // ignore
    }
  };

  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
