import crypto from 'node:crypto';

import { describe, expect, it } from '@jest/globals';

import { unfoldFromSource } from '../core/resonance-unfold';
import { resonanceInputFromSource } from './resonance-input';

function sha256Bytes(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function sha256Json(x: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

function asByteView(x: unknown): Uint8Array | null {
  if (typeof x !== 'object' || x === null) return null;

  // Covers Int8Array, Float32Array, etc.
  if (ArrayBuffer.isView(x)) {
    const view: ArrayBufferView = x;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  return null;
}

function assertNumericVector(v: unknown, expectedLength: number, name: string) {
  expect(v).toBeDefined();

  if (ArrayBuffer.isView(v)) {
    expect((v as any).length).toBe(expectedLength);
    for (let i = 0; i < expectedLength; i++) {
      const x = (v as any)[i] as unknown;
      expect(typeof x).toBe('number');
      expect(Number.isFinite(x as number)).toBe(true);
    }
    const bytes = asByteView(v);
    expect(bytes).not.toBeNull();
    expect(sha256Bytes(bytes!)).toMatch(/^[0-9a-f]{64}$/);
    return;
  }

  if (Array.isArray(v)) {
    expect(v.length).toBe(expectedLength);
    for (const x of v) {
      expect(typeof x).toBe('number');
      expect(Number.isFinite(x)).toBe(true);
    }
    expect(sha256Json(v)).toMatch(/^[0-9a-f]{64}$/);
    return;
  }

  throw new Error(`${name} must be an Array or TypedArray`);
}

describe('resonanceInputFromSource()', () => {
  it('is deterministic for a fixed input (byte-for-byte stable matrices + stable hashes)', () => {
    const src = 'SATOR AREPO TENET OPERA ROTAS';

    const out1 = resonanceInputFromSource(src, { unfold: false });
    const out2 = resonanceInputFromSource(src, { unfold: false });

    // Deep determinism: the entire output should match exactly.
    expect(out2).toEqual(out1);

    expect(typeof out1.mappingVersion).toBe('string');
    expect(out1.mappingVersion.length).toBeGreaterThan(0);

    expect(out1.sourceHash).toBeDefined();
    expect(typeof out1.sourceHash).toBe('string');
    expect((out1.sourceHash as string).length).toBeGreaterThan(0);

    assertNumericVector(out1.transition_matrix, 9, 'transition_matrix');
    assertNumericVector(out1.triplet_matrix, 27, 'triplet_matrix');

    const t1 = asByteView(out1.transition_matrix)!;
    const t2 = asByteView(out2.transition_matrix)!;
    const p1 = asByteView(out1.triplet_matrix)!;
    const p2 = asByteView(out2.triplet_matrix)!;

    // “Golden” stability via hash (no hard-coded matrix values)
    expect(sha256Bytes(t1)).toBe(sha256Bytes(t2));
    expect(sha256Bytes(p1)).toBe(sha256Bytes(p2));
  });

  it('unfoldFromSource() extracts &token:NAME markers and produces marker-free cleanSource', () => {
    const src = 'AB &token:HELLO CD &token:WORLD EF';

    const u = unfoldFromSource(src);

    expect(typeof u.cleanSource).toBe('string');
    expect(u.cleanSource).toContain('AB');
    expect(u.cleanSource).toContain('CD');
    expect(u.cleanSource).toContain('EF');

    // Most important: markers are removed from cleanSource
    expect(u.cleanSource).not.toContain('&');

    expect(Array.isArray(u.markers)).toBe(true);
    expect(u.markers.length).toBeGreaterThanOrEqual(1);

    const tokens = u.markers
      .map((m) => String(m.token))
      .join(' ')
      .toUpperCase();
    expect(tokens).toContain('HELLO');
    expect(tokens).toContain('WORLD');

    expect(Array.isArray(u.unfolds)).toBe(true);
  });

  it('resonanceInputFromSource(..., { unfold: true }) returns unfold artifacts', () => {
    const src = 'AB &token:HELLO CD';

    const out = resonanceInputFromSource(src, { unfold: true });

    expect(out).toBeDefined();
    expect(typeof out).toBe('object');

    // Schema-flexible but strict enough to catch regressions
    expect('cleanSource' in out).toBe(true);
    expect('unfoldMarkers' in out).toBe(true);
    expect('unfolds' in out).toBe(true);

    // Canonical outputs still exist
    expect((out as any).transition_matrix).toBeDefined();
    expect((out as any).triplet_matrix).toBeDefined();
  });
});
