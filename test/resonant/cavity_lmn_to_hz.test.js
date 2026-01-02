import { cavity_lmn_to_hz } from '../../src/resonant/cavity_lmn_to_hz';

describe('cavity_lmn_to_hz', () => {
  test('computes a known TE mode for a 1m cube: TE100 => c/2', () => {
    const hz = cavity_lmn_to_hz({ l: 1, m: 0, n: 0, a: 1, b: 1, c: 1, polarization: 'TE' });
    expect(hz).toBeCloseTo(299792458 / 2, 6);
  });

  test('computes a known TM mode for a 1m cube: TM111 => (c/2)*sqrt(3)', () => {
    const hz = cavity_lmn_to_hz({ l: 1, m: 1, n: 1, a: 1, b: 1, c: 1, polarization: 'TM' });
    expect(hz).toBeCloseTo((299792458 / 2) * Math.sqrt(3), 6);
  });

  test('rejects TM modes with any zero index', () => {
    expect(() =>
      cavity_lmn_to_hz({ l: 1, m: 0, n: 1, a: 1, b: 1, c: 1, polarization: 'TM' }),
    ).toThrow(/TM modes require/);
  });

  test('rejects TE000', () => {
    expect(() =>
      cavity_lmn_to_hz({ l: 0, m: 0, n: 0, a: 1, b: 1, c: 1, polarization: 'TE' }),
    ).toThrow(/TE modes require/);
  });

  test('rejects non-integer indices', () => {
    expect(() => cavity_lmn_to_hz({ l: 1.2, m: 0, n: 0, a: 1, b: 1, c: 1 })).toThrow(/integer/);
  });
});
