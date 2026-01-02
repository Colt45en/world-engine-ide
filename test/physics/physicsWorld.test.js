import { v3 } from '../../src/physics/math.js';
import PhysicsWorld from '../../src/physics/physicsWorld.js';

describe('PhysicsWorld (CPU stub)', () => {
  test('Step integrates velocities and positions', () => {
    const w = new PhysicsWorld();
    w.Initialize({ gravity: { x: 0, y: 0, z: 0 } });

    w.AddBody('b1', {
      initial_transform: v3(0, 0, 0),
      mass: 1,
      shape: { type: 'SPHERE', radius: 0.5 },
    });
    w.UpdateBody('b1', { linear_velocity: v3(1, 0, 0) });

    w.Step(1);
    const b = w.GetBodyState('b1');
    expect(b).not.toBeNull();
    expect(Math.abs(b.position.x - 1)).toBeLessThan(1e-6);
  });

  test('SaveSnapshot and RestoreSnapshot work', () => {
    const w = new PhysicsWorld();
    w.Initialize({ gravity: { x: 0, y: 0, z: 0 } });
    w.AddBody('b1', {
      initial_transform: v3(0, 0, 0),
      mass: 1,
      shape: { type: 'SPHERE', radius: 0.5 },
    });
    w.UpdateBody('b1', { linear_velocity: v3(1, 0, 0) });

    w.SaveSnapshot(10);
    w.Step(1);
    let b = w.GetBodyState('b1');
    expect(b.position.x).toBeGreaterThan(0);

    const ok = w.RestoreSnapshot(10);
    expect(ok).toBe(true);
    b = w.GetBodyState('b1');
    expect(Math.abs(b.position.x - 0)).toBeLessThan(1e-6);
  });

  test('RayCast hits a sphere', () => {
    const w = new PhysicsWorld();
    w.Initialize();
    w.AddBody('s1', {
      initial_transform: v3(5, 0, 0),
      mass: 1,
      shape: { type: 'SPHERE', radius: 1 },
    });

    const hit = w.RayCast(v3(0, 0, 0), v3(10, 0, 0));
    expect(hit).not.toBeNull();
    expect(hit.entity).toBe('s1');
  });
});
