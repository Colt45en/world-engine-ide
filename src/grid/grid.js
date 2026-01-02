/**
 * Authoritative cube grid (3D)
 *
 * Grid cell coordinates g=(i,j,k) are integers.
 * World units are derived from cubeSize s.
 */

export const FACES = /** @type {const} */ ({
  Top: 'Top',
  Bottom: 'Bottom',
  North: 'North',
  South: 'South',
  East: 'East',
  West: 'West',
});

/** @param {number} v @param {number} s */
export function roundToCellIndex(v, s) {
  return Math.round(v / s);
}

/** @param {{x:number,y:number,z:number}} p @param {number} s @returns {[number,number,number]} */
export function worldToCell(p, s) {
  return [roundToCellIndex(p.x, s), roundToCellIndex(p.y, s), roundToCellIndex(p.z, s)];
}

/** @param {[number,number,number]} cell @param {number} s */
export function cellToWorldCenter(cell, s) {
  const [i, j, k] = cell;
  return { x: i * s, y: j * s, z: k * s };
}

/** @param {keyof typeof FACES} face */
export function faceNormal(face) {
  switch (face) {
    case FACES.Top:
      return { x: 0, y: 1, z: 0 };
    case FACES.Bottom:
      return { x: 0, y: -1, z: 0 };
    case FACES.East:
      return { x: 1, y: 0, z: 0 };
    case FACES.West:
      return { x: -1, y: 0, z: 0 };
    case FACES.North:
      return { x: 0, y: 0, z: 1 };
    case FACES.South:
      return { x: 0, y: 0, z: -1 };
    default:
      return { x: 0, y: 1, z: 0 };
  }
}

/**
 * Choose face by hit normal.
 * @param {{x:number,y:number,z:number}} n
 * @returns {keyof typeof FACES}
 */
export function faceFromNormal(n) {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);

  if (ay >= ax && ay >= az) return n.y >= 0 ? FACES.Top : FACES.Bottom;
  if (ax >= ay && ax >= az) return n.x >= 0 ? FACES.East : FACES.West;
  return n.z >= 0 ? FACES.North : FACES.South;
}

/** @param {[number,number,number]} cell */
export function cellKey(cell) {
  return `${cell[0]},${cell[1]},${cell[2]}`;
}

/**
 * Stable yaw snapping (e.g. 90 degree increments).
 * @param {number} yaw
 * @param {number} stepDeg
 */
export function snapYawRadians(yaw, stepDeg = 90) {
  const step = (stepDeg * Math.PI) / 180;
  return Math.round(yaw / step) * step;
}

/**
 * Convert a (cell, face) anchor into a world position.
 * Uses the face center on the cube.
 *
 * @param {[number,number,number]} cell
 * @param {keyof typeof FACES} face
 * @param {number} s
 */
export function anchorToWorld(cell, face, s) {
  const c = cellToWorldCenter(cell, s);
  const n = faceNormal(face);
  return {
    x: c.x + (s / 2) * n.x,
    y: c.y + (s / 2) * n.y,
    z: c.z + (s / 2) * n.z,
  };
}
