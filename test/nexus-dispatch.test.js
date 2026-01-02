const { dispatchMessage } = require('../src/utils/nexus-utils');

describe('dispatchMessage', () => {
  test('delegates to handleBrainMessage when from=brain', () => {
    const m = { __nexus: true, from: 'brain', kind: 'BRAIN_TICK', payload: { tick: 1 } };
    const ctx = {
      handleBrainMessage: jest.fn(),
      handleCodepadMessage: jest.fn(),
      onBrainSub: jest.fn(),
      onBenchResult: jest.fn(),
      onBrainRestored: jest.fn(),
    };
    dispatchMessage(ctx, m);
    expect(ctx.handleBrainMessage).toHaveBeenCalledTimes(1);
    expect(ctx.handleBrainMessage).toHaveBeenCalledWith(m);
    expect(ctx.handleCodepadMessage).not.toHaveBeenCalled();
  });

  test('delegates to handleCodepadMessage when from=codepad', () => {
    const m = { __nexus: true, from: 'codepad', kind: 'CONSOLE', payload: { text: 'hi' } };
    const ctx = {
      handleBrainMessage: jest.fn(),
      handleCodepadMessage: jest.fn(),
      onBrainSub: jest.fn(),
      onBenchResult: jest.fn(),
      onBrainRestored: jest.fn(),
    };
    dispatchMessage(ctx, m);
    expect(ctx.handleCodepadMessage).toHaveBeenCalledTimes(1);
    expect(ctx.handleCodepadMessage).toHaveBeenCalledWith(m);
    expect(ctx.handleBrainMessage).not.toHaveBeenCalled();
  });

  test('falls back to kind handlers when from missing', () => {
    const m = { __nexus: true, kind: 'BRAIN_SUB', payload: { subId: 's1' } };
    const ctx = {
      handleBrainMessage: jest.fn(),
      handleCodepadMessage: jest.fn(),
      onBrainSub: jest.fn(),
      onBenchResult: jest.fn(),
      onBrainRestored: jest.fn(),
    };
    dispatchMessage(ctx, m);
    expect(ctx.onBrainSub).toHaveBeenCalledTimes(1);
    expect(ctx.onBrainSub).toHaveBeenCalledWith(m);
  });

  test('ignores non-nexus messages', () => {
    const m = { foo: 'bar' };
    const ctx = {
      handleBrainMessage: jest.fn(),
      handleCodepadMessage: jest.fn(),
      onBrainSub: jest.fn(),
      onBenchResult: jest.fn(),
      onBrainRestored: jest.fn(),
    };
    dispatchMessage(ctx, m);
    expect(ctx.handleBrainMessage).not.toHaveBeenCalled();
    expect(ctx.handleCodepadMessage).not.toHaveBeenCalled();
    expect(ctx.onBrainSub).not.toHaveBeenCalled();
  });
});
