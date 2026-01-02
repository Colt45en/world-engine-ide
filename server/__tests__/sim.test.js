import { simulatePlayer } from '../sim.js';

describe('simulatePlayer', () => {
  test('moves forward with moveZ=1', () => {
    const p = { x: 0, z: 0, vx: 0, vz: 0, yaw: 0 };
    simulatePlayer(p, { moveX: 0, moveZ: 1, yaw: 0 }, 0.5, { speed: 2 });
    expect(p.z).toBeGreaterThan(0);
  });

  test('clamps bounds', () => {
    const p = { x: 1000, z: 1000, vx: 0, vz: 0, yaw: 0 };
    simulatePlayer(p, { moveX: 0, moveZ: 0 }, 1);
    expect(p.x).toBeLessThanOrEqual(90);
    expect(p.z).toBeLessThanOrEqual(90);
  });
});
