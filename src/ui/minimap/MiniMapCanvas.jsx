import { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { cellCenterWorld, clamp, withAlpha, worldToMapPx } from './math';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function getHudTheme() {
  const root = document.documentElement;
  const styles = globalThis.getComputedStyle ? globalThis.getComputedStyle(root) : null;
  const bg = styles ? (styles.getPropertyValue('--bg') || '').trim() : '';
  const fg = styles ? (styles.getPropertyValue('--fg') || '').trim() : '';
  return {
    bg: bg || '#000000',
    fg: fg || '#ffffff',
  };
}

function drawGrid({ ctx, sizePx, cubeSize, centerWorldX, centerWorldZ, pixelsPerWorld, fg }) {
  const halfWorld = (sizePx * 0.5) / pixelsPerWorld;
  const minX = centerWorldX - halfWorld;
  const maxX = centerWorldX + halfWorld;
  const minZ = centerWorldZ - halfWorld;
  const maxZ = centerWorldZ + halfWorld;

  const startX = Math.floor(minX / cubeSize) * cubeSize;
  const endX = Math.ceil(maxX / cubeSize) * cubeSize;
  const startZ = Math.floor(minZ / cubeSize) * cubeSize;
  const endZ = Math.ceil(maxZ / cubeSize) * cubeSize;

  ctx.strokeStyle = withAlpha(fg, 0.12);
  ctx.lineWidth = 1;

  for (let x = startX; x <= endX; x += cubeSize) {
    const a = worldToMapPx({
      worldX: x,
      worldZ: minZ,
      centerWorldX,
      centerWorldZ,
      sizePx,
      pixelsPerWorld,
    });
    const b = worldToMapPx({
      worldX: x,
      worldZ: maxZ,
      centerWorldX,
      centerWorldZ,
      sizePx,
      pixelsPerWorld,
    });

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (let z = startZ; z <= endZ; z += cubeSize) {
    const a = worldToMapPx({
      worldX: minX,
      worldZ: z,
      centerWorldX,
      centerWorldZ,
      sizePx,
      pixelsPerWorld,
    });
    const b = worldToMapPx({
      worldX: maxX,
      worldZ: z,
      centerWorldX,
      centerWorldZ,
      sizePx,
      pixelsPerWorld,
    });

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Center crosshair
  const c = sizePx * 0.5;
  ctx.strokeStyle = withAlpha(fg, 0.25);
  ctx.beginPath();
  ctx.moveTo(c - 8, c);
  ctx.lineTo(c + 8, c);
  ctx.moveTo(c, c - 8);
  ctx.lineTo(c, c + 8);
  ctx.stroke();
}

function drawAnchors({
  ctx,
  sizePx,
  cubeSize,
  centerWorldX,
  centerWorldZ,
  pixelsPerWorld,
  anchors,
  fg,
}) {
  ctx.fillStyle = withAlpha(fg, 0.85);

  for (const a of anchors) {
    if (!a || !Array.isArray(a.cell) || a.cell.length !== 2) continue;
    const i = a.cell[0];
    const k = a.cell[1];
    if (!Number.isFinite(i) || !Number.isFinite(k)) continue;

    const w = cellCenterWorld(i, k, cubeSize);
    const p = worldToMapPx({
      worldX: w.x,
      worldZ: w.z,
      centerWorldX,
      centerWorldZ,
      sizePx,
      pixelsPerWorld,
    });

    if (p.x < -12 || p.x > sizePx + 12 || p.y < -12 || p.y > sizePx + 12) continue;

    const kind = typeof a.kind === 'string' ? a.kind : 'tile';

    if (kind === 'tile') {
      const s = Math.max(3, cubeSize * pixelsPerWorld * 0.22);
      ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
      continue;
    }

    if (kind === 'tree') {
      const r = Math.max(2.5, cubeSize * pixelsPerWorld * 0.18);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    // prop (diamond)
    const r = Math.max(3, cubeSize * pixelsPerWorld * 0.22);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r);
    ctx.lineTo(p.x + r, p.y);
    ctx.lineTo(p.x, p.y + r);
    ctx.lineTo(p.x - r, p.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPlayer({ ctx, sizePx, fg }) {
  const cx = sizePx * 0.5;
  const cy = sizePx * 0.5;

  ctx.fillStyle = withAlpha(fg, 0.95);
  ctx.beginPath();
  ctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(fg, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
  ctx.stroke();
}

export function MiniMapCanvas({
  sizePx = 180,
  cubeSize = 2,
  zoom = 1,
  anchors = [],
  playerPos = null,
  uiHz = 10,
}) {
  const canvasRef = useRef(null);

  const dataRef = useRef({ cubeSize, zoom, anchors, playerPos });
  useEffect(() => {
    dataRef.current = { cubeSize, zoom, anchors, playerPos };
  }, [cubeSize, zoom, anchors, playerPos]);

  const dpr = useMemo(() => clamp(globalThis.devicePixelRatio || 1, 1, 2), []);
  const drawIntervalMs = useMemo(() => 1000 / Math.max(1, uiHz), [uiHz]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = Math.floor(sizePx * dpr);
    canvas.height = Math.floor(sizePx * dpr);
    canvas.style.width = `${sizePx}px`;
    canvas.style.height = `${sizePx}px`;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let lastDraw = 0;
    let rafId = 0;

    const draw = (now) => {
      rafId = globalThis.requestAnimationFrame(draw);
      if (now - lastDraw < drawIntervalMs) return;
      lastDraw = now;

      const theme = getHudTheme();
      const fg = theme.fg;
      const bg = theme.bg;

      const d = dataRef.current;
      const cube = typeof d.cubeSize === 'number' && d.cubeSize > 0 ? d.cubeSize : 2;
      const z = typeof d.zoom === 'number' ? clamp(d.zoom, 0.25, 4) : 1;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, sizePx, sizePx);

      // Background
      ctx.fillStyle = withAlpha(bg, 0.7);
      roundRect(ctx, 0, 0, sizePx, sizePx, 12);
      ctx.fill();

      const centerWorldX = d.playerPos && typeof d.playerPos.x === 'number' ? d.playerPos.x : 0;
      const centerWorldZ = d.playerPos && typeof d.playerPos.z === 'number' ? d.playerPos.z : 0;

      const cubesAcross = 16;
      const worldSpan = cubesAcross * cube;
      const pixelsPerWorld = (sizePx / worldSpan) * z;

      drawGrid({ ctx, sizePx, cubeSize: cube, centerWorldX, centerWorldZ, pixelsPerWorld, fg });

      const anchorsArr = Array.isArray(d.anchors) ? d.anchors : [];
      drawAnchors({
        ctx,
        sizePx,
        cubeSize: cube,
        centerWorldX,
        centerWorldZ,
        pixelsPerWorld,
        anchors: anchorsArr,
        fg,
      });

      drawPlayer({ ctx, sizePx, fg });

      // Border
      ctx.strokeStyle = withAlpha(fg, 0.2);
      ctx.lineWidth = 1;
      roundRect(ctx, 0.5, 0.5, sizePx - 1, sizePx - 1, 12);
      ctx.stroke();
    };

    rafId = globalThis.requestAnimationFrame(draw);
    return () => globalThis.cancelAnimationFrame(rafId);
  }, [dpr, drawIntervalMs, sizePx]);

  return <canvas ref={canvasRef} aria-label="Mini-map canvas" />;
}

MiniMapCanvas.propTypes = {
  sizePx: PropTypes.number,
  cubeSize: PropTypes.number,
  zoom: PropTypes.number,
  anchors: PropTypes.arrayOf(
    PropTypes.shape({
      cell: PropTypes.arrayOf(PropTypes.number),
      kind: PropTypes.string,
    }),
  ),
  playerPos: PropTypes.shape({
    x: PropTypes.number,
    z: PropTypes.number,
  }),
  uiHz: PropTypes.number,
};
