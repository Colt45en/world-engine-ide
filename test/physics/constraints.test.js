import { v3 } from '../../src/physics/math.js';
import PhysicsWorld from '../../src/physics/physicsWorld.js';

describe('DistanceConstraint', () => {
  test('maintains rest distance between two bodies', () => {
    const w = new PhysicsWorld();
    w.Initialize({ gravity: { x: 0, y: 0, z: 0 }, solver_iterations: 4 });
    w.AddBody('a', {
      initial_transform: v3(0, 0, 0),
      mass: 1,
      shape: { type: 'SPHERE', radius: 0.5 },
    });
    w.AddBody('b', {
      initial_transform: v3(5, 0, 0),
      mass: 1,
      shape: { type: 'SPHERE', radius: 0.5 },
    });

    w.AddConstraint('d1', {
      type: 'DISTANCE',
      body_a_id: 'a',
      body_b_id: 'b',
      local_anchor_a: v3(0, 0, 0),
      local_anchor_b: v3(0, 0, 0),
      rest_distance: 2,
      stiffness: 1,
    });

    // simulate a few steps to let solver converge
    for (let i = 0; i < 10; i++) w.Step(1 / 60);

    const a = w.GetBodyState('a');
    const b = w.GetBodyState('b');
    const dx = b.position.x - a.position.x;
    expect(Math.abs(Math.abs(dx) - 2)).toBeLessThan(0.1);
  });
});
