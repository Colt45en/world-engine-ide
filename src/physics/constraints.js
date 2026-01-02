import { v3add, v3len2, v3scale, v3sub } from './math.js';

export class DistanceConstraint {
  constructor(bodyAId, bodyBId, restDistance, stiffness = 1.0) {
    this.type = 'DISTANCE';
    this.a = bodyAId;
    this.b = bodyBId;
    this.rest = restDistance;
    this.stiffness = stiffness; // 0..1 positional correction factor
  }

  // positional correction applied directly to positions (simple PBD-style)
  solve(world) {
    const A = world.bodies.get(this.a);
    const B = world.bodies.get(this.b);
    if (!A || !B) return;

    const delta = v3sub(B.position, A.position);
    const dist2 = v3len2(delta);
    if (dist2 === 0) return;
    const dist = Math.sqrt(dist2);
    const diff = (dist - this.rest) / dist;

    const invMassA = A.is_kinematic ? 0 : 1 / Math.max(1e-6, A.mass);
    const invMassB = B.is_kinematic ? 0 : 1 / Math.max(1e-6, B.mass);
    const w = invMassA + invMassB;
    if (w === 0) return;

    const correction = this.stiffness * diff;

    const corrA = v3scale(delta, correction * (invMassA / w));
    const corrB = v3scale(delta, -correction * (invMassB / w));

    if (!A.is_kinematic) A.position = v3add(A.position, corrA);
    if (!B.is_kinematic) B.position = v3add(B.position, corrB);
  }
}
