/**
 * Procedural height field contract.
 *
 * This is used only for the terrain visualization and optional surface sampling.
 * Your Phi-vector / scalar field can replace heightAt() as needed.
 */

export function heightAt(x, z) {
  const a = 0.08;
  const b = 0.05;
  return 2 * Math.sin(a * x) + 1.5 * Math.cos(b * z);
}

/**
 * Finite-difference normal from height field:
 * n = normalize( [-dh/dx, 1, -dh/dz] )
 */
export function normalAt(x, z) {
  const e = 0.25;
  const hL = heightAt(x - e, z);
  const hR = heightAt(x + e, z);
  const hD = heightAt(x, z - e);
  const hU = heightAt(x, z + e);

  const dhdx = (hR - hL) / (2 * e);
  const dhdz = (hU - hD) / (2 * e);

  let nx = -dhdx;
  let ny = 1;
  let nz = -dhdz;

  const len = Math.hypot(nx, ny, nz);
  if (len <= 1e-9) return { x: 0, y: 1, z: 0 };

  nx /= len;
  ny /= len;
  nz /= len;

  return { x: nx, y: ny, z: nz };
}

/** Slope gate: require normal.y >= cos(maxSlopeDeg) */
export function isSlopeOk(normal, maxSlopeDeg) {
  const cosMax = Math.cos((maxSlopeDeg * Math.PI) / 180);
  return normal.y >= cosMax;
}
