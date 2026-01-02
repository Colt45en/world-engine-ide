const canvas = document.getElementById('canvas');
const hud = document.getElementById('hud');
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

let connected = false;
let lastFrame = null;

let packetsThisSecond = 0;
let pps = 0;
setInterval(() => {
  pps = packetsThisSecond;
  packetsThisSecond = 0;
}, 1000);

function connect() {
  const ws = new WebSocket(wsUrl);

  ws.addEventListener('open', () => { connected = true; });
  ws.addEventListener('close', () => { connected = false; setTimeout(connect, 500); });

  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    if (msg && msg.type === 'ENV_FRAME') {
      packetsThisSecond++;
      lastFrame = msg;
    }
  });
}
connect();

function safeGet(obj, path, fallback) {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return fallback;
    cur = cur[key];
  }
  return (cur === undefined) ? fallback : cur;
}

function drawGroundLine(groundY) {
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(window.innerWidth, groundY);
  ctx.stroke();
}

function drawEntities(frame, groundY) {
  const entities = Array.isArray(frame.entities) ? frame.entities : [];
  for (const e of entities) {
    const tx = (e && e.transform && typeof e.transform.x === 'number') ? e.transform.x : 0;
    const ty = (e && e.transform && typeof e.transform.y === 'number') ? e.transform.y : 0;
    const x = window.innerWidth * 0.5 + tx * 80;
    const y = groundY - ty * 80;

    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    const tags = Array.isArray(e.tags) ? e.tags : [];
    ctx.fillStyle = tags.includes('player') ? '#22c55e' : '#60a5fa';
    ctx.fill();
  }
}

function buildHudText(frame) {
  const faults = Array.isArray(frame.faults) ? frame.faults : [];
  const lastRepairs = frame.lastRepairs && Array.isArray(frame.lastRepairs.repairs)
    ? frame.lastRepairs.repairs
    : [];

  const t = (typeof frame.t === 'number') ? frame.t.toFixed(3) : 'n/a';

  const fixedDt = safeGet(frame, ['settings', 'fixedDt'], undefined);
  const gravity = safeGet(frame, ['settings', 'gravity'], undefined);
  const backend = safeGet(frame, ['settings', 'backend'], undefined);
  const physicsEnabled = safeGet(frame, ['systems', 'physicsEnabled'], undefined);
  const rendererEnabled = safeGet(frame, ['systems', 'rendererEnabled'], undefined);

  return (
`Bus: ${connected ? 'CONNECTED' : 'DISCONNECTED'}   Packets/sec: ${pps}
Frame: ${frame.frame}   t: ${t}

Settings:
  fixedDt: ${fixedDt}
  gravity: ${JSON.stringify(gravity)}
  backend: ${backend}

Systems:
  physicsEnabled: ${physicsEnabled}
  rendererEnabled: ${rendererEnabled}

Faults (current): ${faults.length}
${faults.map(f => `  - ${f.code}: ${f.detail}`).join('\n') || '  (none)'}

Last Repairs Applied: ${lastRepairs.length}
${lastRepairs.map(r => `  - ${r.code}: ${r.detail}`).join('\n') || '  (none)'}
`
  );
}

function draw() {
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  if (lastFrame) {
    const groundY = window.innerHeight * 0.7;
    drawGroundLine(groundY);
    drawEntities(lastFrame, groundY);
    hud.textContent = buildHudText(lastFrame);
  } else {
    hud.textContent = `Connecting…\n${wsUrl}`;
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
