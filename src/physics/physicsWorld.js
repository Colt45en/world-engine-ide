import { v3, v3add, v3copy, v3dot, v3len2, v3normalize, v3scale, v3sub } from './math.js';
import { DistanceConstraint } from './constraints.js';

function positionFromInitialTransform(initial_transform) {
  // Accept Vec3-like objects directly.
  if (initial_transform && typeof initial_transform === 'object') {
    if (
      typeof initial_transform.x === 'number' &&
      typeof initial_transform.y === 'number' &&
      typeof initial_transform.z === 'number'
    ) {
      return v3copy(initial_transform);
    }
  }

  // Accept Mat4 array-ish with translation at indices 12..14.
  if (
    Array.isArray(initial_transform) ||
    (initial_transform && typeof initial_transform.length === 'number')
  ) {
    const m = initial_transform;
    const tx = Number(m[12] ?? 0);
    const ty = Number(m[13] ?? 0);
    const tz = Number(m[14] ?? 0);
    return v3(tx, ty, tz);
  }

  return v3(0, 0, 0);
}

/**
 * Minimal CPU-backed PhysicsWorld implementing the IPhysicsWorld contract (skeletal)
 */
export default class PhysicsWorld {
  constructor() {
    // NOTE: these Maps are internal implementation details.
    // Prefer HasBody/GetBodyState/ConsumeUpdates for ECS integration.
    this.bodies = new Map(); // entity_id -> body
    this.constraints = new Map(); // constraint_id -> constraint
    this.events = [];
    this.snapshots = new Map();
    this._transformUpdates = [];
    this._velocityUpdates = [];
    this.settings = {
      fixed_timestep: 1 / 60,
      solver_iterations: 4,
      gravity: { x: 0, y: -9.8, z: 0 },
      compute_backend: 'CPU',
    };
  }

  Initialize(settings = {}) {
    this.settings = { ...this.settings, ...settings };
    // No GPU resources in CPU stub
    return true;
  }

  Shutdown() {
    this.bodies.clear();
    this.constraints.clear();
    this.events = [];
    this.snapshots.clear();
    this._transformUpdates = [];
    this._velocityUpdates = [];
  }

  HasBody(entity_id) {
    return this.bodies.has(entity_id);
  }

  GetBodyState(entity_id) {
    const b = this.bodies.get(entity_id);
    if (!b) return null;
    return {
      id: b.id,
      position: v3copy(b.position),
      velocity: v3copy(b.velocity),
      mass: b.mass,
      is_kinematic: !!b.is_kinematic,
      material: { ...b.material },
      shape: b.shape ? { ...b.shape } : null,
    };
  }

  /**
   * Returns the TransformUpdate and VelocityUpdate arrays produced by the last Step(), then clears them.
   */
  ConsumeUpdates() {
    const transforms = this._transformUpdates.slice();
    const velocities = this._velocityUpdates.slice();
    this._transformUpdates.length = 0;
    this._velocityUpdates.length = 0;
    return { transforms, velocities };
  }

  AddBody(entity_id, data) {
    const body = {
      id: entity_id,
      position: positionFromInitialTransform(data.initial_transform),
      velocity: v3(0, 0, 0),
      mass: data.mass || 1,
      is_kinematic: !!data.is_kinematic,
      material: data.material_props || { friction: 0.5, restitution: 0.1 },
      shape: data.shape || { type: 'SPHERE', radius: 0.5 },
    };
    this.bodies.set(entity_id, body);
    return body;
  }

  AddBodies(batch) {
    const out = [];
    for (const item of batch || []) {
      out.push(this.AddBody(item.entity_id, item.data));
    }
    return out;
  }

  RemoveBody(entity_id) {
    this.bodies.delete(entity_id);
  }

  UpdateBody(entity_id, data) {
    const b = this.bodies.get(entity_id);
    if (!b) return null;
    if (typeof data.mass === 'number') b.mass = data.mass;
    if (data.shape) b.shape = data.shape;

    if (typeof data.friction === 'number') b.material.friction = data.friction;
    if (typeof data.restitution === 'number') b.material.restitution = data.restitution;

    // Optional state updates used by gameplay/adapter.
    if (data.linear_velocity) b.velocity = v3copy(data.linear_velocity);
    return b;
  }

  AddConstraint(id, data) {
    // Backward-compatible path: allow passing a constraint object with a solve(world) method.
    if (data && typeof data.solve === 'function') {
      this.constraints.set(id, data);
      return data;
    }

    // Contract path: ConstraintCreationData -> internal constraint instance.
    if (data && data.type === 'DISTANCE') {
      const rest = typeof data.rest_distance === 'number' ? data.rest_distance : 1;
      const stiffness = typeof data.stiffness === 'number' ? data.stiffness : 1;
      const c = new DistanceConstraint(data.body_a_id, data.body_b_id, rest, stiffness);
      this.constraints.set(id, c);
      return c;
    }

    // Unknown constraint type; store raw.
    this.constraints.set(id, data);
    return data;
  }

  Step(dt) {
    // clear per-step outputs
    this._transformUpdates.length = 0;
    this._velocityUpdates.length = 0;

    // Semi-implicit Euler integration for simple bodies + naive collision detection
    const g = this.settings.gravity;
    // Integrate velocity and position
    for (const b of this.bodies.values()) {
      if (b.is_kinematic) continue;
      // acceleration = gravity / mass (ignoring other forces)
      const accel = v3scale(g, 1);
      b.velocity = v3add(b.velocity, v3scale(accel, dt));
      b.position = v3add(b.position, v3scale(b.velocity, dt));
    }

    // Broadphase: simple sweep-and-prune on X axis
    const ids = Array.from(this.bodies.keys());
    const items = ids
      .map((id) => {
        const b = this.bodies.get(id);
        const r = b.shape.radius || 0.5;
        return { id, minX: b.position.x - r, maxX: b.position.x + r };
      })
      .sort((a, b) => a.minX - b.minX);

    const pairs = [];
    for (let i = 0; i < items.length; i++) {
      const A = items[i];
      for (let j = i + 1; j < items.length; j++) {
        const B = items[j];
        if (B.minX > A.maxX) break; // no overlap on X
        pairs.push([A.id, B.id]);
      }
    }

    // Narrowphase: sphere-sphere checks for candidate pairs
    for (const [ida, idb] of pairs) {
      const a = this.bodies.get(ida);
      const b = this.bodies.get(idb);
      if (!a || !b) continue;
      if (a.shape.type !== 'SPHERE' || b.shape.type !== 'SPHERE') continue;
      const r = (a.shape.radius || 0.5) + (b.shape.radius || 0.5);
      const d2 = v3len2(v3sub(a.position, b.position));
      if (d2 <= r * r) {
        const normal = v3normalize(v3sub(b.position, a.position));
        const contactPoint = v3add(a.position, v3scale(normal, a.shape.radius || 0.5));
        const impulse = 0; // placeholder
        this.events.push({
          entity_a_id: a.id,
          entity_b_id: b.id,
          contact_point: contactPoint,
          impulse_magnitude: impulse,
        });
      }
    }

    // Constraint solver iterations
    const iters = Math.max(1, Math.floor(this.settings.solver_iterations || 1));
    for (let k = 0; k < iters; k++) {
      for (const c of this.constraints.values()) {
        if (c.type === 'DISTANCE' && typeof c.solve === 'function') {
          c.solve(this);
        }
      }
    }

    // Produce output buffers for the World Engine to consume.
    for (const b of this.bodies.values()) {
      this._transformUpdates.push({
        entity_id: b.id,
        position: v3copy(b.position),
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      });
      this._velocityUpdates.push({
        entity_id: b.id,
        linear: v3copy(b.velocity),
        angular: v3(0, 0, 0),
      });
    }
  }

  SaveSnapshot(frame_number) {
    const snap = {};
    for (const [id, b] of this.bodies.entries()) {
      snap[id] = { position: v3copy(b.position), velocity: v3copy(b.velocity) };
    }
    this.snapshots.set(frame_number, snap);
  }

  RestoreSnapshot(frame_number) {
    const snap = this.snapshots.get(frame_number);
    if (!snap) return false;
    for (const id of Object.keys(snap)) {
      const b = this.bodies.get(id);
      if (!b) continue;
      b.position = v3copy(snap[id].position);
      b.velocity = v3copy(snap[id].velocity);
    }
    return true;
  }

  RayCast(start, end) {
    // Naive ray-sphere check for SPHERE bodies
    const dir = v3sub(end, start);
    const dirLen2 = v3len2(dir);
    if (dirLen2 === 0) return null;
    const dirN = v3scale(dir, 1 / Math.sqrt(dirLen2));
    let nearest = null;
    let nearestT = Infinity;
    for (const b of this.bodies.values()) {
      if (b.shape.type !== 'SPHERE') continue;
      const L = v3sub(b.position, start);
      const tca = v3dot(L, dirN);
      if (tca < 0) continue;
      const d2 = v3len2(L) - tca * tca;
      const r = b.shape.radius || 0.5;
      if (d2 <= r * r) {
        const thc = Math.sqrt(Math.max(0, r * r - d2));
        const t0 = tca - thc;
        if (t0 < nearestT) {
          nearestT = t0;
          const point = v3add(start, v3scale(dirN, t0));
          nearest = {
            entity: b.id,
            contact_point: point,
            normal: v3normalize(v3sub(point, b.position)),
          };
        }
      }
    }
    return nearest;
  }

  CollectEvents() {
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  GetDebugData() {
    const aabbs = [];
    for (const b of this.bodies.values()) {
      const r = b.shape.radius || 0.5;
      aabbs.push({
        id: b.id,
        min: v3(b.position.x - r, b.position.y - r, b.position.z - r),
        max: v3(b.position.x + r, b.position.y + r, b.position.z + r),
      });
    }
    return { aabbs };
  }
}
