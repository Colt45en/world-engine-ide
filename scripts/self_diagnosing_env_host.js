const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
const publicDir = path.join(__dirname, '../public/self-diagnosing-env');
app.use(express.static(publicDir));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/bus' });

// ------------------------------
// Environment Kernel (authoritative)
// ------------------------------
function createKernel() {
  return {
    version: 1,
    frame: 0,
    time: 0,

    settings: {
      fixedDt: null, // intentionally null to prove self-build
      gravity: null,
      backend: 'CPU',
    },

    pipelines: {
      envBus: null,
      snapshot: null,
    },

    world: {
      entities: new Map(),
      nextEntityId: 1,
    },

    systems: {
      physicsEnabled: false,
      rendererEnabled: false,
    },

    telemetry: {
      lastDiagnoseMs: 0,
      lastRepairMs: 0,
      faults: [],
      repairs: [],
      counters: {
        faultsDetected: 0,
        repairsApplied: 0,
      },
    },
  };
}

// ------------------------------
// Diagnostics (invariant rules)
// ------------------------------
function diagnose(kernel) {
  const faults = [];

  const fixedDt = kernel.settings.fixedDt;
  if (typeof fixedDt !== 'number' || !(fixedDt > 0 && fixedDt <= 0.1)) {
    faults.push({ code: 'INVALID_TIMESTEP', detail: `fixedDt=${fixedDt}` });
  }

  const gravity = kernel.settings.gravity;
  if (!Array.isArray(gravity) || gravity.length !== 3) {
    faults.push({ code: 'NO_GRAVITY_DEFINED', detail: `gravity=${JSON.stringify(gravity)}` });
  }

  if (kernel.world.entities.size === 0) {
    faults.push({ code: 'ZERO_ENTITIES', detail: 'world has no entities' });
  }

  if (!kernel.pipelines.envBus) {
    faults.push({ code: 'MISSING_PIPELINE_ENV_BUS', detail: 'envBus not constructed' });
  }

  if (!kernel.systems.physicsEnabled) {
    faults.push({ code: 'PHYSICS_DISABLED', detail: 'physicsEnabled=false' });
  }

  if (!kernel.systems.rendererEnabled) {
    faults.push({ code: 'RENDERER_DISABLED', detail: 'rendererEnabled=false' });
  }

  return faults;
}

// ------------------------------
// Repair actions (self-build recipes)
// ------------------------------
function applyRepairs(kernel, faults) {
  const repairs = [];

  for (const f of faults) {
    switch (f.code) {
      case 'INVALID_TIMESTEP': {
        kernel.settings.fixedDt = 1 / 60;
        repairs.push({ code: 'SET_DEFAULT_TIMESTEP', detail: 'fixedDt=1/60' });
        break;
      }
      case 'NO_GRAVITY_DEFINED': {
        kernel.settings.gravity = [0, -9.81, 0];
        repairs.push({ code: 'SET_DEFAULT_GRAVITY', detail: 'gravity=[0,-9.81,0]' });
        break;
      }
      case 'ZERO_ENTITIES': {
        const id = kernel.world.nextEntityId++;
        kernel.world.entities.set(id, {
          transform: { x: 0, y: 2, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          tags: ['player'],
        });
        repairs.push({ code: 'SPAWN_DEFAULT_ENTITY', detail: `spawned entity=${id} tag=player` });
        break;
      }
      case 'MISSING_PIPELINE_ENV_BUS': {
        kernel.pipelines.envBus = {
          type: 'WebSocketBroadcast',
          hz: 60,
          lastBroadcastFrame: -1,
        };
        repairs.push({ code: 'CREATE_ENV_BUS_PIPELINE', detail: 'envBus pipeline constructed' });
        break;
      }
      case 'PHYSICS_DISABLED': {
        kernel.systems.physicsEnabled = true;
        repairs.push({ code: 'ENABLE_PHYSICS', detail: 'physicsEnabled=true' });
        break;
      }
      case 'RENDERER_DISABLED': {
        kernel.systems.rendererEnabled = true;
        repairs.push({ code: 'ENABLE_RENDERER', detail: 'rendererEnabled=true' });
        break;
      }
      default: {
        repairs.push({ code: 'NO_REPAIR_AVAILABLE', detail: f.code });
        break;
      }
    }
  }

  return repairs;
}

// ------------------------------
// Simulation step (authoritative)
// ------------------------------
function physicsStep(kernel, dt) {
  const g = kernel.settings.gravity || [0, -9.81, 0];

  for (const e of kernel.world.entities.values()) {
    e.velocity.x += g[0] * dt;
    e.velocity.y += g[1] * dt;
    e.velocity.z += g[2] * dt;

    e.transform.x += e.velocity.x * dt;
    e.transform.y += e.velocity.y * dt;
    e.transform.z += e.velocity.z * dt;

    if (e.transform.y < 0) {
      e.transform.y = 0;
      if (e.velocity.y < 0) e.velocity.y *= -0.35;
    }
  }
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(msg);
  }
}

const kernel = createKernel();

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'HELLO', now: Date.now(), kernelVersion: kernel.version }));
});

const TICK_HZ = 60;
setInterval(
  () => {
    const now = Date.now();

    // 1) Diagnose
    const faults = diagnose(kernel);
    kernel.telemetry.faults = faults;
    kernel.telemetry.counters.faultsDetected += faults.length;
    kernel.telemetry.lastDiagnoseMs = now;

    // 2) Repair
    const repairs = applyRepairs(kernel, faults);
    if (repairs.length > 0) {
      kernel.telemetry.repairs.unshift({ at: now, repairs });
      kernel.telemetry.counters.repairsApplied += repairs.length;
      kernel.telemetry.lastRepairMs = now;
    }

    // 3) Step
    const dt = typeof kernel.settings.fixedDt === 'number' ? kernel.settings.fixedDt : 1 / 60;
    kernel.frame += 1;
    kernel.time += dt;

    if (kernel.systems.physicsEnabled) {
      physicsStep(kernel, dt);
    }

    // 4) Broadcast
    if (kernel.pipelines.envBus) {
      kernel.pipelines.envBus.lastBroadcastFrame = kernel.frame;

      const entities = [];
      for (const [id, e] of kernel.world.entities.entries()) {
        entities.push({ id, transform: e.transform, velocity: e.velocity, tags: e.tags });
      }

      broadcast({
        type: 'ENV_FRAME',
        frame: kernel.frame,
        t: kernel.time,
        settings: kernel.settings,
        systems: kernel.systems,
        faults: kernel.telemetry.faults,
        lastRepairs: kernel.telemetry.repairs[0] || null,
        entities,
      });
    }
  },
  Math.round(1000 / TICK_HZ),
);

server.listen(PORT, () => {
  console.log(`Self-diagnosing environment host: http://localhost:${PORT}`);
  console.log(`Bus: ws://localhost:${PORT}/bus`);
});
