function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clamp(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @typedef {'FrameTimeOverBudget'|'MemoryPressureHigh'|'ConstraintErrorHigh'|'SpawnStorm'|'TelemetryMissing'} FaultCode
 */

/**
 * @typedef {Object} Fault
 * @property {FaultCode} code
 * @property {number} severity 0..1
 * @property {number} confidence 0..1
 * @property {'physics'|'ecs'|'render'|'system'} subsystem
 * @property {{metric:string, raw?:number, normalized?:number, threshold?:number, note?:string}} evidence
 * @property {string[]} suggestedKnobs
 * @property {string[]} suggestedCapsules
 */

/**
 * @typedef {Object} KnobDef
 * @property {string} id
 * @property {number} min
 * @property {number} max
 * @property {number} defaultValue
 * @property {number} maxDeltaPerTick
 */

/**
 * @typedef {Object} CapsuleDef
 * @property {string} id
 * @property {'physics'|'ecs'|'render'|'system'} subsystem
 * @property {number} cooldownFrames
 * @property {function(any, Fault[], any): boolean} pre
 * @property {function(any, Fault[], any): number} risk
 * @property {function(any, Fault[], any): any} run
 */

/**
 * @typedef {Object} StabilizerSnapshot
 * @property {number} frameIndex
 * @property {Record<string, number>} u
 * @property {Record<string, number>} capsuleCooldownLeft
 * @property {Record<string, number>} ema
 */

const DEFAULT_METRICS = {
  // render
  'render.frameTimeMs': { min: 0, max: 33.3, required: false },
  'render.frameBudgetMs': { min: 1, max: 50, required: false },

  // system
  'system.memoryPressure': { min: 0, max: 1, required: false },

  // physics
  'physics.constraintError': { min: 0, max: 0.05, required: false },

  // ecs
  'ecs.spawnRate': { min: 0, max: 500, required: false },
};

const DEFAULT_KNOBS = /** @type {KnobDef[]} */ ([
  { id: 'physics.iterations', min: 1, max: 30, defaultValue: 10, maxDeltaPerTick: 1 },
  { id: 'physics.substeps', min: 1, max: 8, defaultValue: 1, maxDeltaPerTick: 1 },
  { id: 'physics.constraintSoftness', min: 0, max: 1, defaultValue: 0, maxDeltaPerTick: 0.05 },
  { id: 'ecs.spawnRateLimit', min: 0, max: 1000, defaultValue: 1000, maxDeltaPerTick: 100 },
  { id: 'ecs.aiTickStride', min: 1, max: 16, defaultValue: 1, maxDeltaPerTick: 1 },
  { id: 'render.lodBias', min: 0, max: 2, defaultValue: 1, maxDeltaPerTick: 0.1 },
  { id: 'render.particleBudget', min: 0, max: 1, defaultValue: 1, maxDeltaPerTick: 0.1 },
]);

function buildDefaultU() {
  const u = {};
  for (const k of DEFAULT_KNOBS) u[k.id] = k.defaultValue;
  return u;
}

function slewLimited(next, prev, def) {
  const delta = clamp(next - prev, -def.maxDeltaPerTick, def.maxDeltaPerTick);
  return clamp(prev + delta, def.min, def.max);
}

function normalizeMetric(value, def) {
  const v = safeNumber(value, 0);
  const min = safeNumber(def.min, 0);
  const max = safeNumber(def.max, 1);
  if (max <= min) return 0;
  return clamp01((v - min) / (max - min));
}

function makeFault({
  code,
  subsystem,
  metric,
  raw,
  normalized,
  threshold,
  note,
  suggestedKnobs,
  suggestedCapsules,
}) {
  const sev = clamp01(
    (safeNumber(normalized, 0) - safeNumber(threshold, 0)) /
      Math.max(1e-9, 1 - safeNumber(threshold, 0)),
  );
  return /** @type {Fault} */ ({
    code,
    severity: sev,
    confidence: 1,
    subsystem,
    evidence: { metric, raw, normalized, threshold, note },
    suggestedKnobs: suggestedKnobs || [],
    suggestedCapsules: suggestedCapsules || [],
  });
}

function missingFault(metricKey) {
  return /** @type {Fault} */ ({
    code: 'TelemetryMissing',
    severity: 0.5,
    confidence: 0.5,
    subsystem: 'system',
    evidence: { metric: metricKey, note: 'required metric missing' },
    suggestedKnobs: [],
    suggestedCapsules: [],
  });
}

function emaUpdate(prev, next, alpha) {
  const p = safeNumber(prev, next);
  return lerp(p, next, clamp01(alpha));
}

function getCandidatesForFault(code, severity) {
  const s = clamp01(severity);
  if (s <= 0) return [];

  if (code === 'FrameTimeOverBudget') {
    return [
      { knobId: 'render.lodBias', delta: -0.2 * s, score: 3 * s, reason: 'reduce lodBias' },
      {
        knobId: 'render.particleBudget',
        delta: -0.2 * s,
        score: 2.5 * s,
        reason: 'reduce particles',
      },
      { knobId: 'ecs.aiTickStride', delta: 1 * s, score: 1.2 * s, reason: 'throttle AI' },
      { knobId: 'physics.substeps', delta: -1 * s, score: 1 * s, reason: 'reduce substeps' },
    ];
  }

  if (code === 'MemoryPressureHigh') {
    return [
      { knobId: 'ecs.spawnRateLimit', delta: -300 * s, score: 2 * s, reason: 'throttle spawns' },
      {
        knobId: 'render.particleBudget',
        delta: -0.3 * s,
        score: 1 * s,
        reason: 'reduce particles',
      },
    ];
  }

  if (code === 'ConstraintErrorHigh') {
    return [
      { knobId: 'physics.iterations', delta: 2 * s, score: 2.5 * s, reason: 'increase iterations' },
      {
        knobId: 'physics.constraintSoftness',
        delta: 0.1 * s,
        score: 1.5 * s,
        reason: 'soften constraints',
      },
      { knobId: 'physics.substeps', delta: 1 * s, score: 1 * s, reason: 'increase substeps' },
    ];
  }

  if (code === 'SpawnStorm') {
    return [
      { knobId: 'ecs.spawnRateLimit', delta: -500 * s, score: 2 * s, reason: 'throttle spawns' },
    ];
  }

  return [];
}

function applySlewLimits(nextU, prevU, knobDefs) {
  const defsById = new Map(knobDefs.map((k) => [k.id, k]));
  for (const [id, v] of Object.entries(nextU)) {
    const def = defsById.get(id);
    if (!def) continue;
    nextU[id] = slewLimited(v, safeNumber(prevU[id], def.defaultValue), def);
    if (id === 'physics.iterations' || id === 'physics.substeps' || id === 'ecs.aiTickStride') {
      nextU[id] = Math.round(nextU[id]);
    }
  }
  return nextU;
}

export class DiagnosticLibrarian {
  /**
   * @param {{metrics?:Record<string,{min:number,max:number,required?:boolean}>, knobs?:KnobDef[], capsules?:CapsuleDef[], emaAlpha?:number, riskThreshold?:number}} [opts]
   */
  constructor(opts = {}) {
    this.metrics = opts.metrics ? { ...DEFAULT_METRICS, ...opts.metrics } : { ...DEFAULT_METRICS };
    this.knobs = Array.isArray(opts.knobs) ? opts.knobs : DEFAULT_KNOBS;

    this.emaAlpha = Number.isFinite(opts.emaAlpha) ? clamp(opts.emaAlpha, 0.01, 1) : 0.25;
    this.riskThreshold = Number.isFinite(opts.riskThreshold) ? clamp01(opts.riskThreshold) : 0.5;

    this.frameIndex = 0;
    this.u = buildDefaultU();
    this.capsuleCooldownLeft = {};
    this.ema = {};

    /** @type {CapsuleDef[]} */
    this.capsules = Array.isArray(opts.capsules) ? opts.capsules : buildDefaultCapsules();
    for (const c of this.capsules) this.capsuleCooldownLeft[c.id] = 0;
  }

  /**
   * Observe: normalize and smooth inputs.
   * @param {Record<string, any>} metricsRaw
   */
  observe(metricsRaw) {
    const obs = {};
    const faults = [];

    for (const [key, def] of Object.entries(this.metrics)) {
      const raw = metricsRaw && Object.hasOwn(metricsRaw, key) ? metricsRaw[key] : undefined;
      if (raw === undefined || raw === null) {
        if (def.required) faults.push(missingFault(key));
        continue;
      }
      const norm = normalizeMetric(raw, def);
      const prev = this.ema[key];
      const smoothed = emaUpdate(prev, norm, this.emaAlpha);
      this.ema[key] = smoothed;
      obs[key] = { raw: safeNumber(raw, 0), norm: smoothed };
    }

    return { obs, observeFaults: faults };
  }

  /**
   * Diagnose: deterministic fault rules.
   * @param {any} obs
   * @param {Fault[]} observeFaults
   */
  diagnose(obs, observeFaults = []) {
    /** @type {Fault[]} */
    const faults = [...(observeFaults || [])];

    // Frame time over budget: compare frameTimeMs to frameBudgetMs if available.
    const ft = obs['render.frameTimeMs'];
    const fb = obs['render.frameBudgetMs'];
    if (ft && fb && safeNumber(fb.raw, 0) > 0) {
      const ratio = safeNumber(ft.raw, 0) / safeNumber(fb.raw, 16.7);
      if (ratio > 1) {
        const severity = clamp01((ratio - 1) / 1);
        faults.push({
          code: 'FrameTimeOverBudget',
          severity,
          confidence: 1,
          subsystem: 'render',
          evidence: {
            metric: 'render.frameTimeMs',
            raw: ft.raw,
            normalized: ratio,
            threshold: 1,
            note: 'frame time exceeds budget',
          },
          suggestedKnobs: [
            'render.lodBias',
            'render.particleBudget',
            'physics.substeps',
            'ecs.aiTickStride',
          ],
          suggestedCapsules: ['render.reduceWork', 'ecs.throttleAI', 'physics.reduceSubsteps'],
        });
      }
    } else if (ft) {
      // If we only have frameTimeMs, treat > 16.7ms as mild violation baseline.
      const normalized = normalizeMetric(ft.raw, { min: 0, max: 33.3 });
      if (ft.raw > 16.7) {
        faults.push(
          makeFault({
            code: 'FrameTimeOverBudget',
            subsystem: 'render',
            metric: 'render.frameTimeMs',
            raw: ft.raw,
            normalized,
            threshold: 0.5,
            note: 'frame time high (no explicit budget)',
            suggestedKnobs: ['render.lodBias', 'render.particleBudget'],
            suggestedCapsules: ['render.reduceWork'],
          }),
        );
      }
    }

    const mem = obs['system.memoryPressure'];
    if (mem && mem.norm > 0.8) {
      faults.push(
        makeFault({
          code: 'MemoryPressureHigh',
          subsystem: 'system',
          metric: 'system.memoryPressure',
          raw: mem.raw,
          normalized: mem.norm,
          threshold: 0.8,
          note: 'memory pressure high',
          suggestedKnobs: ['render.particleBudget', 'ecs.spawnRateLimit'],
          suggestedCapsules: ['ecs.throttleSpawns'],
        }),
      );
    }

    const ce = obs['physics.constraintError'];
    if (ce && ce.norm > 0.8) {
      faults.push(
        makeFault({
          code: 'ConstraintErrorHigh',
          subsystem: 'physics',
          metric: 'physics.constraintError',
          raw: ce.raw,
          normalized: ce.norm,
          threshold: 0.8,
          note: 'constraint error high',
          suggestedKnobs: ['physics.iterations', 'physics.constraintSoftness', 'physics.substeps'],
          suggestedCapsules: ['physics.increaseIterations', 'physics.softenConstraints'],
        }),
      );
    }

    const sp = obs['ecs.spawnRate'];
    if (sp && sp.norm > 0.8) {
      faults.push(
        makeFault({
          code: 'SpawnStorm',
          subsystem: 'ecs',
          metric: 'ecs.spawnRate',
          raw: sp.raw,
          normalized: sp.norm,
          threshold: 0.8,
          note: 'spawn rate high',
          suggestedKnobs: ['ecs.spawnRateLimit'],
          suggestedCapsules: ['ecs.throttleSpawns'],
        }),
      );
    }

    return faults;
  }

  /**
   * Plan: sparse, slew-limited knob adjustment.
   * @param {Fault[]} faults
   */
  plan(faults) {
    const prevU = this.u;
    const nextU = { ...prevU };

    // Candidate deltas: each entry touches exactly one knob (sparse).
    /** @type {{knobId:string, delta:number, score:number, reason:string}[]} */
    const candidates = [];

    for (const f of faults || []) {
      if (!f) continue;
      candidates.push(...getCandidatesForFault(f.code, f.severity));
    }

    // Greedy sparse selection: at most 2 knobs per tick.
    candidates.sort((a, b) => b.score - a.score);
    const applied = [];
    const touched = new Set();

    for (const c of candidates) {
      if (applied.length >= 2) break;
      if (touched.has(c.knobId)) continue;
      touched.add(c.knobId);
      applied.push(c);

      nextU[c.knobId] = safeNumber(nextU[c.knobId], 0) + safeNumber(c.delta, 0);
    }

    applySlewLimits(nextU, prevU, this.knobs);

    return { u: nextU, appliedCandidates: applied };
  }

  /**
   * SelectMath: enforce capsule preconditions, cooldown and risk.
   * @param {any} obs
   * @param {Fault[]} faults
   * @param {Record<string, number>} u
   */
  selectMath(obs, faults, u) {
    const selected = [];
    for (const c of this.capsules) {
      const left = safeNumber(this.capsuleCooldownLeft[c.id], 0);
      if (left > 0) continue;
      if (!c.pre(obs, faults, u)) continue;
      const r = clamp01(c.risk(obs, faults, u));
      if (r > this.riskThreshold) continue;
      selected.push(c.id);
    }
    return selected;
  }

  /**
   * Apply: returns deterministic actions; does not mutate external systems.
   * @param {any} obs
   * @param {Fault[]} faults
   * @param {Record<string, number>} u
   * @param {string[]} capsules
   */
  apply(obs, faults, u, capsules) {
    const actions = {
      knobs: { ...u },
      capsules: [],
      notes: [],
    };

    const capsuleById = new Map(this.capsules.map((c) => [c.id, c]));
    for (const id of capsules || []) {
      const c = capsuleById.get(id);
      if (!c) continue;
      const payload = c.run(obs, faults, u);
      actions.capsules.push({ id, subsystem: c.subsystem, payload });
    }

    return actions;
  }

  /**
   * Full step: Observe -> Diagnose -> Plan -> SelectMath -> Apply.
   * @param {number} frameIndex
   * @param {Record<string, any>} metricsRaw
   */
  step(frameIndex, metricsRaw) {
    this.frameIndex = Number.isFinite(frameIndex) ? frameIndex : this.frameIndex + 1;

    // Tick down cooldowns deterministically.
    for (const k of Object.keys(this.capsuleCooldownLeft)) {
      this.capsuleCooldownLeft[k] = Math.max(0, safeNumber(this.capsuleCooldownLeft[k], 0) - 1);
    }

    const { obs, observeFaults } = this.observe(metricsRaw || {});
    const faults = this.diagnose(obs, observeFaults);
    const { u: nextU } = this.plan(faults);

    const selectedCapsules = this.selectMath(obs, faults, nextU);

    // Commit u.
    this.u = nextU;

    // Start cooldowns for selected capsules.
    const capsuleById = new Map(this.capsules.map((c) => [c.id, c]));
    for (const id of selectedCapsules) {
      const c = capsuleById.get(id);
      if (c) this.capsuleCooldownLeft[id] = Math.max(0, Math.floor(c.cooldownFrames || 0));
    }

    const actions = this.apply(obs, faults, nextU, selectedCapsules);

    return {
      frameIndex: this.frameIndex,
      obs,
      faults,
      u: nextU,
      capsules: selectedCapsules,
      actions,
    };
  }

  /** @returns {StabilizerSnapshot} */
  saveSnapshot() {
    return {
      frameIndex: this.frameIndex,
      u: { ...this.u },
      capsuleCooldownLeft: { ...this.capsuleCooldownLeft },
      ema: { ...this.ema },
    };
  }

  /** @param {StabilizerSnapshot} snap */
  restoreSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return false;
    this.frameIndex = safeNumber(snap.frameIndex, 0);
    this.u = snap.u ? { ...buildDefaultU(), ...snap.u } : buildDefaultU();
    this.capsuleCooldownLeft = snap.capsuleCooldownLeft ? { ...snap.capsuleCooldownLeft } : {};
    this.ema = snap.ema ? { ...snap.ema } : {};

    // Ensure all known capsules have an entry.
    for (const c of this.capsules) {
      if (!Object.hasOwn(this.capsuleCooldownLeft, c.id)) {
        this.capsuleCooldownLeft[c.id] = 0;
      }
    }
    return true;
  }
}

function hasFault(faults, code) {
  return (faults || []).some((f) => f && f.code === code && f.severity > 0);
}

function buildDefaultCapsules() {
  return /** @type {CapsuleDef[]} */ ([
    {
      id: 'render.reduceWork',
      subsystem: 'render',
      cooldownFrames: 10,
      pre: (obs, faults) => hasFault(faults, 'FrameTimeOverBudget') && !!obs['render.frameTimeMs'],
      risk: () => 0.2,
      run: (obs) => ({ reason: 'frame-time', frameTimeMs: obs['render.frameTimeMs']?.raw }),
    },
    {
      id: 'ecs.throttleAI',
      subsystem: 'ecs',
      cooldownFrames: 15,
      pre: (_obs, faults, u) =>
        hasFault(faults, 'FrameTimeOverBudget') && safeNumber(u['ecs.aiTickStride'], 1) < 4,
      risk: () => 0.3,
      run: (_obs, _faults, u) => ({ aiTickStride: u['ecs.aiTickStride'] }),
    },
    {
      id: 'physics.reduceSubsteps',
      subsystem: 'physics',
      cooldownFrames: 10,
      pre: (_obs, faults, u) =>
        hasFault(faults, 'FrameTimeOverBudget') && safeNumber(u['physics.substeps'], 1) > 1,
      risk: () => 0.4,
      run: (_obs, _faults, u) => ({ substeps: u['physics.substeps'] }),
    },
    {
      id: 'ecs.throttleSpawns',
      subsystem: 'ecs',
      cooldownFrames: 30,
      pre: (_obs, faults) =>
        hasFault(faults, 'MemoryPressureHigh') || hasFault(faults, 'SpawnStorm'),
      risk: () => 0.25,
      run: (_obs, _faults, u) => ({ spawnRateLimit: u['ecs.spawnRateLimit'] }),
    },
    {
      id: 'physics.increaseIterations',
      subsystem: 'physics',
      cooldownFrames: 10,
      pre: (_obs, faults) => hasFault(faults, 'ConstraintErrorHigh'),
      risk: () => 0.2,
      run: (_obs, _faults, u) => ({ iterations: u['physics.iterations'] }),
    },
    {
      id: 'physics.softenConstraints',
      subsystem: 'physics',
      cooldownFrames: 10,
      pre: (_obs, faults) => hasFault(faults, 'ConstraintErrorHigh'),
      risk: () => 0.35,
      run: (_obs, _faults, u) => ({ constraintSoftness: u['physics.constraintSoftness'] }),
    },
  ]);
}
