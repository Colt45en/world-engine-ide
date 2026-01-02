// Minimal math system: request/response over the shared event bus.
// Uses deterministic operations only (no eval).

function nowMs() {
  return Date.now();
}

function asFiniteNumber(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeOp(op, a, b) {
  switch (op) {
    case 'add':
      return a + b;
    case 'sub':
      return a - b;
    case 'mul':
      return a * b;
    case 'div':
      return b === 0 ? null : a / b;
    default:
      return null;
  }
}

export class MathSystem {
  get name() {
    return 'MathSystem';
  }

  /**
   * @param {{ bus: any, logger?: any }} opts
   */
  constructor(opts) {
    this.bus = opts.bus;
    this.log = opts.logger || console;
    this._unsub = null;
  }

  start() {
    if (!this.bus || typeof this.bus.subscribe !== 'function') return;

    this._unsub = this.bus.subscribe('MATH', (evt) => {
      if (!evt || evt.channel !== 'MATH') return;
      if (evt.type !== 'OP') return;

      const p = evt.payload || {};
      const op = typeof p.op === 'string' ? p.op : '';
      const a = asFiniteNumber(p.a);
      const b = asFiniteNumber(p.b);
      const requestId = typeof p.requestId === 'string' ? p.requestId : null;

      if (a == null || b == null) {
        this.bus.emit({
          channel: 'MATH',
          type: 'RESULT',
          payload: { requestId, ok: false, error: 'invalid operands', op, a: p.a, b: p.b },
          atMs: nowMs(),
        });
        return;
      }

      const result = computeOp(op, a, b);
      if (result == null || !Number.isFinite(result)) {
        this.bus.emit({
          channel: 'MATH',
          type: 'RESULT',
          payload: { requestId, ok: false, error: 'invalid operation', op, a, b },
          atMs: nowMs(),
        });
        return;
      }

      this.bus.emit({
        channel: 'MATH',
        type: 'RESULT',
        payload: { requestId, ok: true, op, a, b, result },
        atMs: nowMs(),
      });
    });
  }

  stop() {
    if (this._unsub) this._unsub();
    this._unsub = null;
  }

  /**
   * Synchronous helper (does not use the bus).
   * @param {'add'|'sub'|'mul'|'div'} op
   * @param {number} a
   * @param {number} b
   */
  compute(op, a, b) {
    const aa = asFiniteNumber(a);
    const bb = asFiniteNumber(b);
    if (aa == null || bb == null) return null;
    return computeOp(op, aa, bb);
  }
}
