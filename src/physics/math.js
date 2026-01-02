// Minimal vector helpers used by the physics core
export function v3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}
export function v3add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
export function v3scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
export function v3copy(a) {
  return { x: a.x, y: a.y, z: a.z };
}
export function v3len2(a) {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}
export function v3sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
export function v3dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
export function v3normalize(a) {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}
