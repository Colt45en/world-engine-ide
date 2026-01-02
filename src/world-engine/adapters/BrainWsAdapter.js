// Minimal skeleton adapter (not yet wired everywhere).
// Intentionally thin: connect/reconnect + JSON send/receive, all routing/state lives in WorldEngineGateway.

export class BrainWsAdapter {
  /**
   * @param {{ url: string, logger?: any }} opts
   */
  constructor(opts) {
    this._url = opts.url;
    this._log = opts.logger || console;
    this._ws = null;
    this._gateway = null;
  }

  setGateway(gateway) {
    this._gateway = gateway;
  }

  connect() {
    if (!this._url) return;
    try {
      this._ws = new WebSocket(this._url);
    } catch (e) {
      this._log.warn('BrainWsAdapter connect failed', e);
      return;
    }

    this._ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (this._gateway) this._gateway.onTransportMessage('transport.ws.brain', msg);
    });
  }

  disconnect() {
    try {
      if (this._ws) this._ws.close();
    } catch {
      // ignore close errors
    }
    this._ws = null;
  }

  sendJson(obj) {
    if (!this._ws || this._ws.readyState !== 1) return false;
    try {
      this._ws.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }
}
