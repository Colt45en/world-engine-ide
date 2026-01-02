import { FixedStepAccumulator } from './fixedStep.js';
import { v3copy } from './math.js';
import PhysicsWorld from './physicsWorld.js';

/**
 * Adapter between a simple ECS shape and the PhysicsWorld
 * ECS shape expected:
 *  entities: Map<id, { transform: { position: {x,y,z}, rotation: {x,y,z,w} }, physics?: { mass, is_kinematic, shape } }>
 */

export function createPhysicsAdapter() {
  const world = new PhysicsWorld();
  const fixed = new FixedStepAccumulator(world);

  return {
    world,

    initialize(settings) {
      const ok = world.Initialize(settings);
      fixed.setFixedTimestep(
        world.settings && world.settings.fixed_timestep ? world.settings.fixed_timestep : 1 / 60,
      );
      fixed.reset(0);
      return ok;
    },

    shutdown() {
      world.Shutdown();
      fixed.reset(0);
    },

    syncAddEntities(entities) {
      for (const [id, ent] of entities.entries()) {
        if (ent.physics && !world.HasBody(id)) {
          const data = {
            initial_transform: ent.transform?.position
              ? v3copy(ent.transform.position)
              : v3copy({ x: 0, y: 0, z: 0 }),
            mass: ent.physics.mass ?? 1,
            is_kinematic: !!ent.physics.is_kinematic,
            material_props: ent.physics.material_props || { friction: 0.5, restitution: 0.1 },
            shape: ent.physics.shape || { type: 'SPHERE', radius: 0.5 },
          };
          world.AddBody(id, data);
        }
      }
    },

    syncRemoveEntities(entities) {
      for (const id of entities) {
        if (!entities.has(id) && world.bodies.has(id)) {
          world.RemoveBody(id);
        }
      }
    },

    // Update existing bodies with latest component data
    syncUpdateEntities(entities) {
      for (const [id, ent] of entities.entries()) {
        const phys = ent.physics;
        if (!phys) continue;
        if (!world.bodies.has(id)) continue;

        const up = {};
        if (phys.mass !== undefined) up.mass = phys.mass;
        if (phys.friction !== undefined) up.friction = phys.friction;
        if (phys.restitution !== undefined) up.restitution = phys.restitution;
        if (phys.shape) up.shape = phys.shape;
        world.UpdateBody(id, up);
      }
    },

    /**
     * Advance physics by variable dt using a fixed-step accumulator.
     * Returns the accumulator output for render interpolation.
     */
    stepFixed(dt) {
      return fixed.advance(dt);
    },

    /**
     * Step physics and write-back latest fixed-step transforms into ECS.
     * Behavior is backward-compatible: returns collision events array.
     */
    stepAndWriteBack(entities, dt) {
      const out = fixed.advance(dt);
      const transforms = out.steps > 0 ? Array.from(out.currTransforms.values()) : [];
      const velocities = out.steps > 0 ? Array.from(out.currVelocities.values()) : [];

      const velById = new Map(velocities.map((v) => [v.entity_id, v]));

      // write-back
      for (const t of transforms) {
        const ent = entities.get(t.entity_id);
        if (!ent) continue;
        if (!ent.transform) ent.transform = {};
        ent.transform.position = v3copy(t.position);
        // rotation unchanged in this simple stub
        if (ent.physics) {
          const vu = velById.get(t.entity_id);
          if (vu) ent.physics.velocity = v3copy(vu.linear);
        }
      }
      // collect events
      return out.events;
    },

    /**
     * Access the most recent fixed frame pair for render interpolation.
     * - `prev` corresponds to X_k
     * - `curr` corresponds to X_{k+1}
     */
    getFramePair() {
      return {
        frameIndex: fixed.frameIndex,
        alpha: fixed.alpha,
        prev: fixed.prevTransforms,
        curr: fixed.currTransforms,
      };
    },

    saveSnapshot(frame) {
      if (typeof frame === 'number') {
        world.SaveSnapshot(frame);
        return;
      }
      fixed.saveSnapshot();
    },
    restoreSnapshot(frame) {
      if (typeof frame === 'number') return fixed.restoreSnapshot(frame);
      return false;
    },

    raycast(start, end) {
      return world.RayCast(start, end);
    },
  };
}
