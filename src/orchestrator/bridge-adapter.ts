import type { Bridge, BridgeResult } from './bridges';
import type { EnvelopeV1 } from './orchestrator';

export type LinkSendResult = {
  ok: boolean;
  detail?: string;
  error?: string;
  retryable?: boolean;
};

function toLinkSendResult(res: BridgeResult): LinkSendResult {
  if (res.ok) return { ok: true, detail: res.detail };
  return { ok: false, error: res.error, retryable: res.retryable };
}

export function bridgeAsLinkSender(bridge: Bridge) {
  return {
    send: async (env: EnvelopeV1): Promise<LinkSendResult> => {
      const res = await bridge.send(env);
      return toLinkSendResult(res);
    },
  };
}
