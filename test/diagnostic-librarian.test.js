import { DiagnosticLibrarian } from '../src/stability/diagnosticLibrarian.js';

describe('DiagnosticLibrarian (hybrid stabilizer)', () => {
  test('detects FrameTimeOverBudget and changes at most 2 knobs per tick', () => {
    const lib = new DiagnosticLibrarian();

    const out = lib.step(100, {
      'render.frameTimeMs': 40,
      'render.frameBudgetMs': 16.67,
    });

    const ftFault = out.faults.find((f) => f.code === 'FrameTimeOverBudget');
    expect(ftFault).toBeTruthy();
    expect(ftFault.severity).toBeGreaterThan(0);

    // Verify sparsity: at most 2 knobs differ from defaults.
    const defaults = new DiagnosticLibrarian().u;
    const changed = Object.keys(out.u).filter((k) => out.u[k] !== defaults[k]);
    expect(changed.length).toBeLessThanOrEqual(2);
  });

  test('snapshot/restore yields deterministic outputs', () => {
    const lib = new DiagnosticLibrarian();

    // Snapshot BEFORE stepping so restore returns to identical pre-step state.
    const snap0 = lib.saveSnapshot();

    const a1 = lib.step(1, { 'render.frameTimeMs': 25 });

    // Restore and rerun the same frame+inputs; outputs should match.
    const ok = lib.restoreSnapshot(snap0);
    expect(ok).toBe(true);

    const a2 = lib.step(1, { 'render.frameTimeMs': 25 });

    expect(a2.u).toEqual(a1.u);
    expect(a2.capsules).toEqual(a1.capsules);
    expect(a2.faults.map((f) => f.code)).toEqual(a1.faults.map((f) => f.code));
  });
});
