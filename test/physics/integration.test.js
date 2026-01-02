import { createPhysicsAdapter } from '../../src/physics/adapter.js';
import { v3 } from '../../src/physics/math.js';

describe('Physics <-> ECS integration', () => {
  test('Adapter syncs ECS to physics and back', () => {
    const ecs = new Map();
    ecs.set('e1', {
      transform: { position: v3(0, 0, 0) },
      physics: { mass: 1, shape: { type: 'SPHERE', radius: 0.5 } },
    });

    const adapter = createPhysicsAdapter();
    adapter.initialize({ gravity: { x: 0, y: 0, z: 0 } });

    adapter.syncAddEntities(ecs);

    // apply local input by setting body velocity in the physics world
    adapter.world.UpdateBody('e1', { linear_velocity: v3(2, 0, 0) });

    // Step in fixed-size frames; large dt values are clamped to avoid spiral-of-death.
    let events = [];
    for (let i = 0; i < 60; i++) {
      events = adapter.stepAndWriteBack(ecs, 1 / 60);
    }
    expect(ecs.get('e1').transform.position.x).toBeCloseTo(2, 5);
    expect(events).toBeInstanceOf(Array);
  });
});
