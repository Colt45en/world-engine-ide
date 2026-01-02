/**
 * Fixed-step accumulator wrapper.
 *
 * Consumes variable dt, advances the underlying world in exact h steps, and
 * retains (X_k, X_{k+1}) for render interpolation.
 */

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function toMapById(list) {
  const m = new Map();
  for (const item of list || []) {
    if (item && item.entity_id != null) m.set(item.entity_id, item);
  }
  return m;
}

export class FixedStepAccumulator {
  /**
   * @param {import('./interfaces.js').default|any} world
   * @param {{fixedTimestep?:number,maxSubSteps?:number}} [opts]
   */
  constructor(world, opts = {}) {
    this.world = world;
    this.fixedTimestep = isFiniteNumber(opts.fixedTimestep) ? opts.fixedTimestep : 1 / 60;
    this.maxSubSteps = isFiniteNumber(opts.maxSubSteps)
      ? Math.max(1, Math.floor(opts.maxSubSteps))
      : 8;

    this.frameIndex = 0;
    this.accumulator = 0;
    this.alpha = 0;

    this._initialized = false;

    this.prevTransforms = new Map();
    this.currTransforms = new Map();
    this.prevVelocities = new Map();
    this.currVelocities = new Map();
  }

  setFixedTimestep(h) {
    if (isFiniteNumber(h) && h > 0) this.fixedTimestep = h;
  }

  reset(frameIndex = 0) {
    this.frameIndex = frameIndex;
    this.accumulator = 0;
    this.alpha = 0;
    this._initialized = false;

    this.prevTransforms = new Map();
    this.currTransforms = new Map();
    this.prevVelocities = new Map();
    this.currVelocities = new Map();
  }

  /**
   * Advance by variable dt, stepping the world in fixed ticks.
   *
   * Returns both the last two fixed frames (k and k+1) and the interpolation alpha.
   *
   * @param {number} dt
   * @returns {{frameIndex:number, steps:number, alpha:number, prevTransforms:Map<any,any>, currTransforms:Map<any,any>, prevVelocities:Map<any,any>, currVelocities:Map<any,any>, events:any[]}}
   */
  advance(dt) {
    if (!isFiniteNumber(dt) || dt <= 0) {
      return {
        frameIndex: this.frameIndex,
        steps: 0,
        alpha: this.alpha,
        prevTransforms: this.prevTransforms,
        currTransforms: this.currTransforms,
        prevVelocities: this.prevVelocities,
        currVelocities: this.currVelocities,
        events: [],
      };
    }

    // Prevent spiral-of-death from giant frame hitches.
    const clampedDt = Math.min(dt, this.fixedTimestep * this.maxSubSteps);
    this.accumulator += clampedDt;

    let steps = 0;
    const events = [];

    while (this.accumulator >= this.fixedTimestep && steps < this.maxSubSteps) {
      this.world.Step(this.fixedTimestep);

      const { transforms, velocities } = this.world.ConsumeUpdates();
      const tMap = toMapById(transforms);
      const vMap = toMapById(velocities);

      if (this._initialized) {
        this.prevTransforms = this.currTransforms;
        this.currTransforms = tMap;
        this.prevVelocities = this.currVelocities;
        this.currVelocities = vMap;
      } else {
        this.prevTransforms = tMap;
        this.currTransforms = tMap;
        this.prevVelocities = vMap;
        this.currVelocities = vMap;
        this._initialized = true;
      }

      const ev = this.world.CollectEvents();
      if (Array.isArray(ev) && ev.length) events.push(...ev);

      this.frameIndex += 1;
      this.accumulator -= this.fixedTimestep;
      steps += 1;
    }

    this.alpha =
      this.fixedTimestep > 0
        ? Math.max(0, Math.min(0.999999, this.accumulator / this.fixedTimestep))
        : 0;

    return {
      frameIndex: this.frameIndex,
      steps,
      alpha: this.alpha,
      prevTransforms: this.prevTransforms,
      currTransforms: this.currTransforms,
      prevVelocities: this.prevVelocities,
      currVelocities: this.currVelocities,
      events,
    };
  }

  saveSnapshot() {
    this.world.SaveSnapshot(this.frameIndex);
  }

  restoreSnapshot(frameIndex) {
    const ok = this.world.RestoreSnapshot(frameIndex);
    if (ok) this.reset(frameIndex);
    return ok;
  }
}
