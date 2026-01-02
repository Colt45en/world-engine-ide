const utils = require('../src/utils/nexus-utils');

describe('nexus utils', () => {
  test('computeTelemetrySample computes avgSpeed, count, collisions and cluster', () => {
    const payload = {
      tick: 1,
      snapshot: {
        entities: {
          a: { id: 'a', x: 0, y: 0, vx: 3, vy: 4 }, // speed 5
          b: { id: 'b', x: 10, y: 0, vx: 0, vy: 0 }, // speed 0
          c: { id: 'c', x: 5, y: 5, vx: -3, vy: 4 }, // speed 5
        },
      },
      collisions: [{}, {}],
    };

    const s = utils.computeTelemetrySample(payload);
    expect(s.tick).toBe(1);
    expect(s.total).toBe(3);
    expect(Math.abs(s.avgSpeed - (5 + 0 + 5) / 3)).toBeLessThan(1e-6);
    expect(s.collisions).toBe(2);
    expect(s.cluster && typeof s.cluster.maxCount === 'number').toBeTruthy();
  });

  test('computeTelemetrySummary aggregates telemetry buffer', () => {
    const buf = [
      {
        tick: 1,
        total: 3,
        avgSpeed: 1,
        collisions: 0,
        cluster: { maxCount: 1, cellX: 0, cellY: 0 },
      },
      {
        tick: 2,
        total: 4,
        avgSpeed: 2,
        collisions: 1,
        cluster: { maxCount: 3, cellX: 1, cellY: 1 },
      },
      {
        tick: 3,
        total: 5,
        avgSpeed: 3,
        collisions: 2,
        cluster: { maxCount: 2, cellX: 2, cellY: 2 },
      },
    ];
    const summary = utils.computeTelemetrySummary(buf);
    expect(summary.tick).toBe(3);
    expect(summary.totalEntities).toBe(5);
    expect(summary.avgCollisions).toBeGreaterThanOrEqual(1);
    expect(summary.avgSpeed).toBeGreaterThanOrEqual(1);
    expect(summary.peakCount).toBe(3);
    expect(summary.hotspot).toMatch(/cell\(1,1\)=3/);
  });

  test('validateConsultantRecommendation rejects invalid recs and accepts valid', () => {
    const allowed = ['increase_cellSize', 'none'];
    const ok = utils.validateConsultantRecommendation(
      { action: 'increase_cellSize', confidence: 0.8 },
      allowed,
      () => ({ ok: true }),
    );
    expect(ok.ok).toBe(true);

    expect(utils.validateConsultantRecommendation(null, allowed)).toEqual({
      ok: false,
      reason: 'no action',
    });
    expect(
      utils.validateConsultantRecommendation({ action: 'bad', confidence: 0.5 }, allowed),
    ).toEqual({ ok: false, reason: 'action not allowed' });
    expect(
      utils.validateConsultantRecommendation({ action: 'none', confidence: 2 }, allowed),
    ).toEqual({ ok: false, reason: 'invalid confidence' });
    const s = utils.validateConsultantRecommendation(
      { action: 'none', confidence: 0.5 },
      allowed,
      () => ({ ok: false, reason: 'unsafe' }),
    );
    expect(s.ok).toBe(false);
    expect(s.reason).toMatch(/safety check failed/);
  });

  test('buildAuditEntry includes timestamp and merges fields', () => {
    const e = utils.buildAuditEntry({ type: 'test', foo: 'bar' });
    expect(e.t).toBeDefined();
    expect(e.type).toBe('test');
    expect(e.foo).toBe('bar');
  });
});
