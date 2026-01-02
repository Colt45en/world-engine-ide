/**
 * Rectangular cavity resonant frequency.
 *
 * Implements the standard closed-form for a perfectly conducting rectangular cavity:
 *
 *   f = (c0 / 2) * sqrt((l/a)^2 + (m/b)^2 + (n/c)^2)
 *
 * where a,b,c are side lengths (meters) and l,m,n are non-negative integers.
 *
 * Polarization constraints:
 * - TM: l,m,n must all be > 0
 * - TE: at least one of l,m,n must be > 0 (zeros are allowed)
 *
 * @param {object} params
 * @param {number} params.l
 * @param {number} params.m
 * @param {number} params.n
 * @param {number} params.a meters
 * @param {number} params.b meters
 * @param {number} params.c meters
 * @param {'TE'|'TM'} [params.polarization='TE']
 * @param {number} [params.c0=299792458] speed of light (m/s)
 * @returns {number} frequency in Hz
 */
export function cavity_lmn_to_hz({ l, m, n, a, b, c, polarization = 'TE', c0 = 299792458 }) {
  const L = normalizeNonNegativeInt(l, 'l');
  const M = normalizeNonNegativeInt(m, 'm');
  const N = normalizeNonNegativeInt(n, 'n');

  assertPositiveFinite(a, 'a');
  assertPositiveFinite(b, 'b');
  assertPositiveFinite(c, 'c');
  assertPositiveFinite(c0, 'c0');

  if (polarization !== 'TE' && polarization !== 'TM') {
    throw new Error(`polarization must be 'TE' or 'TM' (got ${String(polarization)})`);
  }

  if (polarization === 'TM') {
    if (L === 0 || M === 0 || N === 0) {
      throw new Error('TM modes require l,m,n all > 0');
    }
  }

  if (polarization === 'TE') {
    // TE modes: not all indices zero.
    if (L === 0 && M === 0 && N === 0) {
      throw new Error('TE modes require at least one of l,m,n > 0');
    }
  }

  const term = (L / a) ** 2 + (M / b) ** 2 + (N / c) ** 2;
  return (c0 / 2) * Math.sqrt(term);
}

function assertPositiveFinite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive finite number`);
  }
}

function normalizeNonNegativeInt(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  const rounded = Math.trunc(value);
  if (rounded !== value) {
    throw new TypeError(`${name} must be an integer`);
  }
  if (rounded < 0) {
    throw new Error(`${name} must be >= 0`);
  }
  return rounded;
}
