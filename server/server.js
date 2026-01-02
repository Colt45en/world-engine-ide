import { WebSocketServer } from 'ws';

const TICK_HZ = 20;
const DT = 1 / TICK_HZ; // 0.05s
const PORT = 8080;

const wss = new WebSocketServer({ port: PORT });
console.log(`WS server listening on ws://localhost:${PORT}`);

let nextPlayerId = 1;
let serverTick = 0;

// --- Authoritative world state ---
const world = {
  players: new Map(), // id -> player
};

import { simulatePlayer } from './sim.js';

// --- Utilities ---
// (simulatePlayer now provided by sim.js)
function buildSnapshotFor(playerId) {
  const me = world.players.get(playerId);
  if (!me) return null;

  const players = [];
  for (const p of world.players.values()) {
    players.push({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: p.vx,
      vy: p.vy,
      vz: p.vz,
      yaw: p.yaw,
      hp: p.hp,
    });
  }

  return {
    type: 'snap',
    serverTick,
    ackSeq: me.lastProcessedInputSeq,
    me: { id: me.id },
    players,
  };
}

// --- Connection handling ---
wss.on('connection', (ws) => {
  const id = nextPlayerId++;
  const player = {
    id,
    x: 0,
    y: 1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    hp: 100,
    inputQueue: [],
    lastProcessedInputSeq: 0,
    ws,
  };
  world.players.set(id, player);

  ws.send(JSON.stringify({ type: 'hello', id, tickHz: TICK_HZ }));
  console.log(`Player connected: ${id}`);

  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }

    if (msg.type === 'input') {
      const seq = msg.seq >>> 0;
      const input = {
        seq,
        moveX: Number(msg.moveX) || 0,
        moveZ: Number(msg.moveZ) || 0,
        yaw: Number(msg.yaw) || 0,
      };
      player.inputQueue.push(input);
    }
  });

  ws.on('close', () => {
    world.players.delete(id);
    console.log(`Player disconnected: ${id}`);
  });
});

// --- Main fixed tick ---
setInterval(() => {
  serverTick++;

  for (const p of world.players.values()) {
    let input = null;
    if (p.inputQueue.length) {
      while (p.inputQueue.length) {
        input = p.inputQueue.shift();
        p.lastProcessedInputSeq = input.seq;
      }
    }

    simulatePlayer(p, input, DT);
  }

  for (const p of world.players.values()) {
    if (p.ws.readyState !== 1) continue;
    const snap = buildSnapshotFor(p.id);
    if (snap) p.ws.send(JSON.stringify(snap));
  }
}, 1000 / TICK_HZ);
