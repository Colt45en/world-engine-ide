// Utility functions mirrored from nexus-dual.html for unit testing

function computeAvgSpeed(sampleIds, entities) {
  let sumSpeed = 0;
  let speedCount = 0;
  for (const id of sampleIds) {
    const e = entities[id];
    if (!e) continue;
    const vx = Number(e.vx || 0);
    const vy = Number(e.vy || 0);
    const sp = Math.hypot(vx, vy);
    sumSpeed += sp;
    speedCount++;
  }
  return { avgSpeed: speedCount ? sumSpeed / speedCount : 0, count: speedCount };
}

function computeCluster(sampleIds, entities) {
  const cluster = { maxCount: 0, cellX: 0, cellY: 0 };
  if (!sampleIds || !sampleIds.length) return cluster;

  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity;
  for (const id of sampleIds) {
    const e = entities[id];
    if (!e) continue;
    minx = Math.min(minx, e.x || 0);
    miny = Math.min(miny, e.y || 0);
    maxx = Math.max(maxx, e.x || 0);
    maxy = Math.max(maxy, e.y || 0);
  }
  const cols = 10;
  const rows = 10;
  const grid = new Array(cols * rows).fill(0);
  const w = Math.max(1, maxx - minx);
  const h = Math.max(1, maxy - miny);
  for (const id of sampleIds) {
    const e = entities[id];
    if (!e) continue;
    const cx = Math.min(cols - 1, Math.floor((((e.x || 0) - minx) / w) * cols));
    const cy = Math.min(rows - 1, Math.floor((((e.y || 0) - miny) / h) * rows));
    const idx = cx + cy * cols;
    grid[idx] = (grid[idx] || 0) + 1;
  }
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > cluster.maxCount) {
      cluster.maxCount = grid[i];
      cluster.cellX = i % cols;
      cluster.cellY = Math.floor(i / cols);
    }
  }
  return cluster;
}

function computeTelemetrySample(payload) {
  const snap = payload && payload.snapshot ? payload.snapshot : null;
  const entities = snap && snap.entities ? snap.entities : {};
  const ids = Object.keys(entities);
  const total = ids.length;
  const sampleIds = ids.slice(0, 2000);

  const sp = computeAvgSpeed(sampleIds, entities);
  const avgSpeed = sp.avgSpeed;
  const collisions = Array.isArray(payload && payload.collisions) ? payload.collisions.length : 0;
  const cluster = computeCluster(sampleIds, entities);

  return { tick: (payload && payload.tick) || 0, total, avgSpeed, collisions, cluster };
}

function computeTelemetrySummary(buf) {
  if (!buf || !buf.length) return null;
  const last = buf[buf.length - 1];
  const totalEntities = last.total || 0;
  const avgCollisions =
    Math.round((buf.reduce((a, b) => a + (b.collisions || 0), 0) / buf.length) * 100) / 100;
  const avgSpeed =
    Math.round((buf.reduce((a, b) => a + (b.avgSpeed || 0), 0) / buf.length) * 100) / 100;
  let peak = { maxCount: 0, cellX: 0, cellY: 0 };
  for (const s of buf) {
    if (s.cluster && s.cluster.maxCount > peak.maxCount) {
      peak = s.cluster;
    }
  }
  const hotspot = peak.maxCount > 0 ? `cell(${peak.cellX},${peak.cellY})=${peak.maxCount}` : 'none';
  const stuckCount = buf.filter((s) => (s.avgSpeed || 0) < 0.02).length;
  const summary = {
    tick: last.tick,
    totalEntities,
    avgCollisions,
    avgSpeed,
    hotspot,
    peakCount: peak.maxCount,
    stuckCount,
    samples: buf.length,
  };
  return summary;
}

function validateCellSize(v, level) {
  const val = Number(v || 0);
  if (!Number.isFinite(val) || val <= 0 || val > 10000)
    return { ok: false, reason: 'cellSize out of bounds' };
  if (level === 'high' && val > 1024)
    return { ok: false, reason: 'cellSize too large for high safety' };
  return { ok: true };
}

function validateDt(v, level) {
  const val = Number(v || 0);
  if (!Number.isFinite(val) || val <= 0 || val > 1)
    return { ok: false, reason: 'dt out of bounds' };
  if (level === 'high' && val < 0.0005)
    return { ok: false, reason: 'dt too small for high safety' };
  return { ok: true };
}

function validateConsultantRecommendation(rec, allowedActions = [], evaluateSafetyFn = null) {
  if (!rec || typeof rec.action !== 'string') return { ok: false, reason: 'no action' };
  if (!Array.isArray(allowedActions) || !allowedActions.includes(rec.action))
    return { ok: false, reason: 'action not allowed' };
  const c = Number(rec.confidence || 0);
  if (!Number.isFinite(c) || c < 0 || c > 1) return { ok: false, reason: 'invalid confidence' };
  if (evaluateSafetyFn) {
    const safe = evaluateSafetyFn(rec);
    if (!safe.ok) return { ok: false, reason: 'safety check failed: ' + safe.reason };
  }
  return { ok: true };
}

function buildAuditEntry(entry) {
  return entry ? { t: Date.now(), ...entry } : { t: Date.now() };
}

function dispatchMessage(ctx, m) {
  if (!m || !m.__nexus) return;
  try {
    const fromMap = { brain: 'handleBrainMessage', codepad: 'handleCodepadMessage' };
    if (m.from && fromMap[m.from] && ctx[fromMap[m.from]]) return ctx[fromMap[m.from]](m);

    const kindMap = {
      BRAIN_SUB: 'onBrainSub',
      BENCH_RESULT: 'onBenchResult',
      BRAIN_RESTORED: 'onBrainRestored',
    };
    if (m.kind && kindMap[m.kind] && ctx[kindMap[m.kind]]) return ctx[kindMap[m.kind]](m);
  } catch (err) {
    console.warn('dispatchMessage failed', err);
  }
}

module.exports = {
  computeAvgSpeed,
  computeTelemetrySample,
  computeTelemetrySummary,
  validateCellSize,
  validateDt,
  validateConsultantRecommendation,
  buildAuditEntry,
  dispatchMessage,
};
