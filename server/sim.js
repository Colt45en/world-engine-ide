export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function simulatePlayer(p, input, dt, opts = {}) {
  const SPEED = opts.speed ?? 6.0;

  const moveX = clamp((input && Number(input.moveX)) || 0, -1, 1);
  const moveZ = clamp((input && Number(input.moveZ)) || 0, -1, 1);

  let len = Math.hypot(moveX, moveZ);
  let nx = moveX,
    nz = moveZ;
  if (len > 1e-6) {
    if (len > 1) {
      nx /= len;
      nz /= len;
    }
  } else {
    nx = 0;
    nz = 0;
  }

  const yaw = Number(input && input.yaw) || p.yaw;
  p.yaw = yaw;

  p.vx = nx * SPEED;
  p.vz = nz * SPEED;
  p.x += p.vx * dt;
  p.z += p.vz * dt;

  p.x = clamp(p.x, -90, 90);
  p.z = clamp(p.z, -90, 90);

  return p;
}
