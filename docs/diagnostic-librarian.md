# Diagnostic Librarian (Hybrid Stabilizer)

This subsystem is a deterministic, frame-indexed closed-loop stabilizer that sits between raw environment signals (metrics) and the set of mathematical operations (“capsules”) allowed to act.

It has four roles:

- **Librarian**: defines which metrics exist and their semantics.
- **Diagnostic**: detects instability, drift, missing/contradictory inputs.
- **Controller**: computes minimal knob adjustments to restore invariants.
- **Gatekeeper**: releases only the required math capsules, at the correct rate.

The design here is **Hybrid**:

- **Rules** decide _what’s wrong_ (faults).
- A **sparse controller** decides _how much to change_ (knobs), minimizing the number of knobs touched per tick.

## 0) Pre-calculation math contract

Before any calculations that depend on trigonometric or inverse-trigonometric functions, apply the operator-DAG + analytic continuation + identity + derivative constraints in [docs/math-trig-contract.md](docs/math-trig-contract.md).

Before any calculations that use the $(\Phi)$-vector model (harmonic, seked bias, triad energy, snapping), use the equation-only contract in [docs/math-phi-vector-contract.md](docs/math-phi-vector-contract.md).

Before any calculations that depend on quaternion rotation, camera-frame transforms, projection, or SLERP interpolation, use the equation-only contract in [docs/math-quaternion-camera-contract.md](docs/math-quaternion-camera-contract.md).

## 1) Contracts

### 1.1 Metrics → Observations

Input metrics are keyed, unitful values from subsystems:

- physics: constraint error, residual, penetration depth, etc.
- ecs: entity counts, spawn rate, churn
- render: frame time, draw calls
- system/net: memory pressure, jitter

The librarian normalizes metrics into an observation vector $y_t$ (dimensionless, bounded):

$$y_t = \mathcal{N}(x_t)$$

Normalization is per-metric, using expected operating bounds.

### 1.2 Fault schema

A **fault** is a deterministic record:

```ts
export type Fault = {
  code: FaultCode;
  severity: number; // [0..1]
  confidence: number; // [0..1]
  subsystem: 'physics' | 'ecs' | 'render' | 'system';
  evidence: {
    metric: string;
    raw?: number;
    normalized?: number;
    threshold?: number;
    note?: string;
  };
  suggestedKnobs: string[]; // knob ids
  suggestedCapsules: string[]; // capsule ids
};
```

Severity is derived from how far a metric violates its invariant; confidence is lowered when inputs are missing/contradictory.

### 1.3 Knobs (control vector u)

Minimal default knob set (monotonic, reversible, safe):

| Knob id                      | Subsystem | Meaning                    |     Range | Default |   Slew limit |
| ---------------------------- | --------- | -------------------------- | --------: | ------: | -----------: |
| `physics.iterations`         | physics   | solver iterations          |   [1..30] |      10 |    ±1 / tick |
| `physics.substeps`           | physics   | substep count              |    [1..8] |       1 |    ±1 / tick |
| `physics.constraintSoftness` | physics   | constraint softness scalar |    [0..1] |     0.0 | ±0.05 / tick |
| `ecs.spawnRateLimit`         | ecs       | max spawns per tick        | [0..1000] |    1000 |  ±100 / tick |
| `ecs.aiTickStride`           | ecs       | run AI every N ticks       |   [1..16] |       1 |    ±1 / tick |
| `render.lodBias`             | render    | LOD bias scalar            |    [0..2] |     1.0 |  ±0.1 / tick |
| `render.particleBudget`      | render    | particle budget scalar     |    [0..1] |     1.0 |  ±0.1 / tick |

All knobs are applied via `actions` produced by the stabilizer (the stabilizer is not the authority; it proposes).

### 1.4 Math capsules (gated math)

A math capsule is an effectful, budgeted operation:

```ts
export type Capsule = {
  id: string;
  subsystem: 'physics' | 'ecs' | 'render' | 'system';
  cooldownFrames: number; // minimum frames between activations
  pre: (obs, faults, u) => boolean;
  risk: (obs, faults, u) => number; // [0..1]
  run: (obs, faults, u) => any; // produces an action payload
};
```

Gate decision (per capsule, per frame):

$$\text{allow}(k,t)=\big[\text{pre}_k \land \text{cooldown}_k \land \text{risk}_k\le \tau\big]$$

### 1.5 Snapshot / rollback

If rollback matters, the stabilizer must be:

- **pure** w.r.t. inputs and its own state
- **frame-indexed** (no wall clocks)
- **snapshottable**

Snapshot state includes:

- `frameIndex`
- last applied knobs `u_{t-1}`
- per-capsule cooldown counters
- any smoothing/hysteresis state (EMAs)

## 2) Hybrid policy: sparse, rate-limited control

Given observations and faults, the controller produces a new knob vector $u_t$.

Objective (conceptual):

$$u_t^* = \arg\min_u \big(\|g(x_t,u)\|_+^2 + \lambda\|u-u_{t-1}\|_2^2 + \mu\|u-u_{t-1}\|_1\big)$$

Implementation uses a deterministic greedy approximation:

1. Rules generate candidate knob deltas for each fault.
2. Candidates are scored by “violation reduction per change cost”.
3. Apply the best few deltas (sparse), then apply slew limits.

## 3) Default fault → knob/capsule mapping (gating matrix)

| Fault code            | Primary metric            | Knobs (preferred order)                                                           | Capsules                                                        |
| --------------------- | ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `FrameTimeOverBudget` | `render.frameTimeMs`      | `render.lodBias`, `render.particleBudget`, `physics.substeps`, `ecs.aiTickStride` | `render.reduceWork`, `ecs.throttleAI`, `physics.reduceSubsteps` |
| `MemoryPressureHigh`  | `system.memoryPressure`   | `render.particleBudget`, `ecs.spawnRateLimit`                                     | `ecs.throttleSpawns`                                            |
| `ConstraintErrorHigh` | `physics.constraintError` | `physics.iterations`, `physics.constraintSoftness`, `physics.substeps`            | `physics.increaseIterations`, `physics.softenConstraints`       |
| `SpawnStorm`          | `ecs.spawnRate`           | `ecs.spawnRateLimit`                                                              | `ecs.throttleSpawns`                                            |
| `TelemetryMissing`    | missing required metric   | (none)                                                                            | (none)                                                          |

## 4) Integration point

The stabilizer should run on the same fixed-step timeline as simulation:

- call `step(frameIndex, metrics)` once per fixed tick
- include stabilizer snapshot in rollback snapshots
- apply its `actions` to subsystems at deterministic boundaries (e.g., before stepping physics)

See implementation in `src/stability/diagnosticLibrarian.js`.
