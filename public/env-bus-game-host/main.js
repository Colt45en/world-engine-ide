/**
 * Browser Game Host that:
 * - Connects to ws://<host>/bus
 * - Buffers the latest environment frames
 * - Runs a fixed timestep sim loop
 * - Renders a small “world” to canvas
 */

const canvas = document.getElementById('canvas');
const hudText = document.getElementById('hudText');
const ctx = canvas.getContext('2d', { alpha: false });

function resize() {
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const wsUrl = (() => {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/bus`;
})();

let ws;
let connected = false;

const envBuffer = [];
const ENV_BUFFER_MAX = 8;
let lastEnv = null;

let packetsThisSecond = 0;
let pps = 0;
setInterval(() => {
  pps = packetsThisSecond;
  packetsThisSecond = 0;
}, 1000);

function connectBus() {
  ws = new WebSocket(wsUrl);

  ws.addEventListener('open', () => {
    connected = true;
    ws.send(JSON.stringify({ type: 'PING' }));
  });

  ws.addEventListener('close', () => {
    connected = false;
    setTimeout(connectBus, 500);
  });

  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    if (msg && msg.type === 'ENV_FRAME') {
      packetsThisSecond++;
      envBuffer.push(msg);
      if (envBuffer.length > ENV_BUFFER_MAX) envBuffer.shift();
      lastEnv = msg;
    }
  });
}
connectBus();

const world = {
  player: {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    radius: 16
  },
  gravity: { x: 0, y: 800 },
  wind: { x: 0, y: 0 }
};

const input = { left: false, right: false, up: false, down: false };
globalThis.addEventListener('keydown', (e) => setKey(e.code, true));
globalThis.addEventListener('keyup', (e) => setKey(e.code, false));

function setKey(code, down) {
  if (code === 'ArrowLeft' || code === 'KeyA') input.left = down;
  if (code === 'ArrowRight' || code === 'KeyD') input.right = down;
  if (code === 'ArrowUp' || code === 'KeyW') input.up = down;
  if (code === 'ArrowDown' || code === 'KeyS') input.down = down;
}

const FIXED_DT = 1 / 60;
let accumulator = 0;
let lastTs = performance.now() / 1000;

function step(dt) {
  if (lastEnv) {
    world.gravity.x = lastEnv.gravity[0];
    world.gravity.y = -lastEnv.gravity[1];
    world.wind.x = lastEnv.wind[0];
    world.wind.y = 0;
  }

  const accel = { x: 0, y: 0 };
  const moveAccel = 900;

  if (input.left) accel.x -= moveAccel;
  if (input.right) accel.x += moveAccel;
  if (input.up) accel.y -= moveAccel;
  if (input.down) accel.y += moveAccel;

  accel.x += world.wind.x;
  accel.y += world.gravity.y;

  world.player.vel.x += accel.x * dt;
  world.player.vel.y += accel.y * dt;

  world.player.vel.x *= 0.995;
  world.player.vel.y *= 0.995;

  world.player.pos.x += world.player.vel.x * dt;
  world.player.pos.y += world.player.vel.y * dt;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = world.player.radius;

  if (world.player.pos.x < r) { world.player.pos.x = r; world.player.vel.x *= -0.6; }
  if (world.player.pos.x > w - r) { world.player.pos.x = w - r; world.player.vel.x *= -0.6; }
  if (world.player.pos.y < r) { world.player.pos.y = r; world.player.vel.y *= -0.6; }
  if (world.player.pos.y > h - r) { world.player.pos.y = h - r; world.player.vel.y *= -0.6; }
}

function render() {
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  if (lastEnv && lastEnv.targets && lastEnv.targets[0]) {
    const t = lastEnv.targets[0];
    const cx = window.innerWidth / 2 + t.pos[0];
    const cy = window.innerHeight / 2 + t.pos[1];
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#8b5cf6';
    ctx.fill();
  }

  const px = world.player.pos.x;
  const py = world.player.pos.y;

  ctx.beginPath();
  ctx.arc(px, py, world.player.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();

  const env = lastEnv;
  const windX = (env && env.wind && typeof env.wind[0] === 'number') ? env.wind[0].toFixed(2) : 'n/a';
  const gravY = (env && env.gravity && typeof env.gravity[1] === 'number') ? env.gravity[1].toFixed(2) : 'n/a';

  hudText.textContent =
    `Bus: ${connected ? 'CONNECTED' : 'DISCONNECTED'}
WS:  ${wsUrl}
Packets/sec: ${pps}

Env(t): ${env && typeof env.t === 'number' ? env.t.toFixed(3) : 'n/a'}
Wind.x: ${windX}
Gravity.y: ${gravY}

Player:
  pos: (${px.toFixed(1)}, ${py.toFixed(1)})
  vel: (${world.player.vel.x.toFixed(1)}, ${world.player.vel.y.toFixed(1)})

Tip: WASD / Arrows to push against the streamed environment`;
}

function loop() {
  const now = performance.now() / 1000;
  let frameDt = now - lastTs;
  lastTs = now;

  frameDt = Math.min(frameDt, 0.05);

  accumulator += frameDt;
  while (accumulator >= FIXED_DT) {
    step(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  render();

  requestAnimationFrame(loop);
}

world.player.pos.x = window.innerWidth * 0.5;
world.player.pos.y = window.innerHeight * 0.3;

requestAnimationFrame(loop);
