const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

// Tools (mini-games, utilities)
app.use('/tools', express.static(path.join(__dirname, '../public/tools')));

// Serve only the env-bus game host assets from its folder.
const publicDir = path.join(__dirname, '../public/env-bus-game-host');
app.use(express.static(publicDir));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/bus' });

function makeEnvPacket(simTimeSec) {
  const windX = Math.sin(simTimeSec * 0.7) * 3;
  const windZ = Math.cos(simTimeSec * 0.5) * 2;

  const targetRadius = 120;
  const targetX = Math.cos(simTimeSec * 0.6) * targetRadius;
  const targetY = Math.sin(simTimeSec * 0.9) * 30;
  const targetZ = Math.sin(simTimeSec * 0.6) * targetRadius;

  return {
    type: 'ENV_FRAME',
    t: simTimeSec,
    gravity: [0, -600, 0],
    wind: [windX * 60, 0, windZ * 60],
    targets: [{ id: 1, pos: [targetX, targetY, targetZ], vel: [0, 0, 0] }],
    meta: { source: 'server-math-stream', version: 1 },
  };
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(msg);
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'HELLO', now: Date.now(), bus: 'env' }));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg && msg.type === 'PING') {
      ws.send(JSON.stringify({ type: 'PONG', now: Date.now() }));
    }
  });
});

const STREAM_HZ = 60;
const STREAM_DT = 1 / STREAM_HZ;
let simTime = 0;

setInterval(
  () => {
    simTime += STREAM_DT;
    broadcast(makeEnvPacket(simTime));
  },
  Math.round(1000 / STREAM_HZ),
);

server.listen(PORT, () => {
  console.log(`Env-bus game host running on http://localhost:${PORT}`);
  console.log(`WebSocket bus at ws://localhost:${PORT}/bus`);
});
