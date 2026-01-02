import { WOW_LITE_SCHEMA_VERSION } from '../../control-plane/wowLiteProtocol';

function bindLogger(logger) {
  const base = logger || console;
  return {
    info: typeof base.info === 'function' ? base.info.bind(base) : () => {},
    warn: typeof base.warn === 'function' ? base.warn.bind(base) : () => {},
    error: typeof base.error === 'function' ? base.error.bind(base) : () => {},
  };
}

function bindClock(clock) {
  const base = clock || { nowMs: () => Date.now() };
  return {
    nowMs: typeof base.nowMs === 'function' ? base.nowMs : () => Date.now(),
  };
}

function createWowLiteState(wowLite) {
  const cfg = wowLite && typeof wowLite === 'object' ? wowLite : {};
  const hostInstanceId = typeof cfg.hostInstanceId === 'string' ? cfg.hostInstanceId : null;
  const desiredRateHz = typeof cfg.desiredRateHz === 'number' ? cfg.desiredRateHz : 10;
  const telemetryEnabled = typeof cfg.telemetryEnabled === 'boolean' ? cfg.telemetryEnabled : true;
  const telemetryHz = typeof cfg.telemetryHz === 'number' ? cfg.telemetryHz : 20;

  return {
    adapter: null,
    hostInstanceId,
    desiredRateHz,
    telemetryEnabled,
    telemetryHz,
    ready: false,
  };
}

function createToolWindowState(toolWindow) {
  const cfg = toolWindow && typeof toolWindow === 'object' ? toolWindow : {};

  return {
    adapter: null,
    enabled: Boolean(cfg.enabled ?? true),
    ready: false,
  };
}

export class WorldEngineGateway {
  /**
   * @param {{
   *  logger?: { info?: Function, warn?: Function, error?: Function },
   *  clock?: { nowMs?: () => number },
   *  wowLite?: { hostInstanceId: string, desiredRateHz?: number, telemetryEnabled?: boolean, telemetryHz?: number }
   *  toolWindow?: { enabled?: boolean }
   * }} opts
   */
  constructor(opts = {}) {
    this._log = bindLogger(opts.logger);
    this._clock = bindClock(opts.clock);
    this._subs = new Set();
    this._wow = createWowLiteState(opts.wowLite);
    this._tool = createToolWindowState(opts.toolWindow);
  }

  start() {
    if (this._wow.adapter && typeof this._wow.adapter.start === 'function') {
      this._wow.adapter.start();
    }
    if (this._tool.adapter && typeof this._tool.adapter.start === 'function') {
      this._tool.adapter.start();
    }
  }

  stop() {
    if (this._wow.adapter && typeof this._wow.adapter.stop === 'function') {
      this._wow.adapter.stop();
    }
    if (this._tool.adapter && typeof this._tool.adapter.stop === 'function') {
      this._tool.adapter.stop();
    }
    this._subs.clear();
  }

  /** @param {any} adapter */
  attachWowLite(adapter) {
    this._wow.adapter = adapter;
    if (adapter && typeof adapter.setGateway === 'function') {
      adapter.setGateway(this);
    }
  }

  /** @param {any} adapter */
  attachToolWindow(adapter) {
    this._tool.adapter = adapter;
    if (adapter && typeof adapter.setGateway === 'function') {
      adapter.setGateway(this);
    }
  }

  /** @param {(evt: any) => void} handler */
  subscribe(handler) {
    this._subs.add(handler);
    return () => this._subs.delete(handler);
  }

  _emit(evt) {
    for (const sub of this._subs) {
      try {
        sub(evt);
      } catch (e) {
        this._log.warn('gateway subscriber error', e);
      }
    }
  }

  getWowLiteState() {
    return { ...this._wow };
  }

  getToolWindowState() {
    return { ...this._tool };
  }

  openToolWindow() {
    if (!this._tool.enabled) return false;
    if (!this._tool.adapter || typeof this._tool.adapter.open !== 'function') return false;
    const ok = Boolean(this._tool.adapter.open());
    if (ok) {
      this._tool.ready = false;
      this.sendToolWindow({
        type: 'ENGINE/HELLO',
        atMs: this._clock.nowMs(),
        hostInstanceId: this._wow.hostInstanceId ?? undefined,
      });
    }
    return ok;
  }

  isToolWindowOpen() {
    if (!this._tool.adapter || typeof this._tool.adapter.isOpen !== 'function') return false;
    return Boolean(this._tool.adapter.isOpen());
  }

  closeToolWindow() {
    if (!this._tool.adapter || typeof this._tool.adapter.close !== 'function') return;
    this._tool.ready = false;
    this._tool.adapter.close();
  }

  /**
   * Single choke point for host -> tool window messages.
   * @param {any} msg
   */
  sendToolWindow(msg) {
    if (!this._tool.enabled) return false;
    if (!this._tool.adapter || typeof this._tool.adapter.send !== 'function') return false;
    return this._tool.adapter.send(msg);
  }

  setWowLiteTelemetryEnabled(enabled) {
    this._wow.telemetryEnabled = Boolean(enabled);
    if (this._wow.ready) {
      this.sendWowLite({
        type: 'WOW_LITE/DEBUG_SET',
        schemaVersion: WOW_LITE_SCHEMA_VERSION,
        hostInstanceId: this._wow.hostInstanceId,
        telemetryEnabled: this._wow.telemetryEnabled,
        telemetryHz: this._wow.telemetryHz,
      });
    }
  }

  /**
   * Single choke point for host -> WoW-Lite messages.
   * @param {any} msg
   */
  sendWowLite(msg) {
    if (!this._wow.adapter || typeof this._wow.adapter.send !== 'function') return false;
    return this._wow.adapter.send(msg);
  }

  _sendWowLiteConfig() {
    if (!this._wow.hostInstanceId) return;
    this.sendWowLite({
      type: 'WOW_LITE/CONFIG',
      schemaVersion: WOW_LITE_SCHEMA_VERSION,
      desiredRateHz: this._wow.desiredRateHz,
      hostInstanceId: this._wow.hostInstanceId,
      telemetryEnabled: this._wow.telemetryEnabled,
      telemetryHz: this._wow.telemetryHz,
    });
  }

  _handleWowLiteTransport(sourceId, msg) {
    if (sourceId !== 'transport.pm.wowLite') return false;
    if (!msg || typeof msg !== 'object') return true;

    if (msg.schemaVersion !== WOW_LITE_SCHEMA_VERSION) {
      this._emit({
        type: 'GATEWAY/REJECT',
        source: sourceId,
        reason: 'schemaVersion mismatch',
        msg,
      });
      return true;
    }

    if (
      this._wow.hostInstanceId &&
      msg.hostInstanceId &&
      msg.hostInstanceId !== this._wow.hostInstanceId
    ) {
      this._emit({
        type: 'GATEWAY/REJECT',
        source: sourceId,
        reason: 'hostInstanceId mismatch',
        msg,
      });
      return true;
    }

    if (msg.type === 'WOW_LITE/READY') {
      this._wow.ready = true;
      this._sendWowLiteConfig();
    }

    this._emit({ type: 'GATEWAY/MSG', source: sourceId, atMs: this._clock.nowMs(), msg });
    return true;
  }

  _handleToolWindowTransport(sourceId, msg) {
    if (sourceId !== 'transport.pm.toolWindow') return false;
    if (!msg || typeof msg !== 'object') return true;

    if (typeof msg.type !== 'string') {
      this._emit({ type: 'GATEWAY/REJECT', source: sourceId, reason: 'missing type', msg });
      return true;
    }

    if (msg.type === 'TOOL/READY') {
      this._tool.ready = true;
    }

    this._emit({ type: 'GATEWAY/MSG', source: sourceId, atMs: this._clock.nowMs(), msg });
    return true;
  }

  /**
   * Adapters call this for all incoming transport messages.
   * @param {string} sourceId
   * @param {any} msg
   */
  onTransportMessage(sourceId, msg) {
    if (this._handleWowLiteTransport(sourceId, msg)) return;
    if (this._handleToolWindowTransport(sourceId, msg)) return;
    this._emit({ type: 'GATEWAY/MSG', source: sourceId, atMs: this._clock.nowMs(), msg });
  }
}
