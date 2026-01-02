export function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export function worldToMapPx({
  worldX,
  worldZ,
  centerWorldX,
  centerWorldZ,
  sizePx,
  pixelsPerWorld,
}) {
  const half = sizePx * 0.5;
  const dx = worldX - centerWorldX;
  const dz = worldZ - centerWorldZ;

  // Screen coordinates: +X right, +Z down.
  const x = half + dx * pixelsPerWorld;
  const y = half + dz * pixelsPerWorld;

  return { x, y };
}

export function cellCenterWorld(i, k, cubeSize) {
  return { x: i * cubeSize, z: k * cubeSize };
}

function parseHexColor(color) {
  if (typeof color !== 'string') return null;
  const c = color.trim();
  if (!c.startsWith('#')) return null;

  const hex = c.slice(1);
  if (hex.length === 3) {
    const r = Number.parseInt(hex[0] + hex[0], 16);
    const g = Number.parseInt(hex[1] + hex[1], 16);
    const b = Number.parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  if (hex.length === 6) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  return null;
}

function parseRgbColor(color) {
  if (typeof color !== 'string') return null;
  const c = color.trim();

  const open = c.indexOf('(');
  const close = c.lastIndexOf(')');
  if (open <= 0 || close !== c.length - 1) return null;

  const fn = c.slice(0, open).trim().toLowerCase();
  if (fn !== 'rgb' && fn !== 'rgba') return null;

  const parts = c
    .slice(open + 1, close)
    .split(',')
    .map((p) => p.trim());

  if (parts.length !== 3 && parts.length !== 4) return null;

  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if (![r, g, b].every((v) => Number.isFinite(v))) return null;

  return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
}

export function withAlpha(color, alpha) {
  const a = clamp(alpha, 0, 1);
  const rgb = parseHexColor(color) || parseRgbColor(color);
  if (!rgb) return `rgba(255,255,255,${a})`;
  return `rgba(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)},${a})`;
}
