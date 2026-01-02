// Thin adapter: tool popup window <-> engine window via postMessage.
// - Owns window.open / close
// - Owns origin filtering
// - Forwards inbound messages to gateway
// - Does NOT do routing/state/correlation (gateway does)

export class ToolWindowPostMessageAdapter {
  /**
   * @param {{
   *  toolOrigin: string,
   *  toolUrl: string,
   *  name?: string,
   *  features?: string,
   *  hostWindow?: any,
   *  logger?: { warn?: Function, info?: Function, error?: Function },
   * }} opts
   */
  constructor(opts) {
    this._log = opts.logger || console;

    this._toolOrigin = opts.toolOrigin;
    try {
      this._toolOrigin = new URL(opts.toolOrigin).origin;
    } catch (err) {
      if (this._log && typeof this._log.warn === 'function')
        this._log.warn('ToolWindowPostMessageAdapter invalid toolOrigin', err);
    }

    this._toolUrl = opts.toolUrl;
    this._name = opts.name || 'NexusTool';
    this._features = opts.features || 'width=1200,height=800';
    this._hostWindow = opts.hostWindow || globalThis;
    this._gateway = null;
    this._toolWin = null;

    this._onMessage = (event) => {
      if (!event || event.origin !== this._toolOrigin) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
      if (this._gateway) this._gateway.onTransportMessage('transport.pm.toolWindow', msg);
    };
  }

  setGateway(gateway) {
    this._gateway = gateway;
  }

  start() {
    if (!this._hostWindow || !this._hostWindow.addEventListener) return;
    this._hostWindow.addEventListener('message', this._onMessage);
  }

  stop() {
    if (!this._hostWindow || !this._hostWindow.removeEventListener) return;
    this._hostWindow.removeEventListener('message', this._onMessage);
  }

  isOpen() {
    return Boolean(this._toolWin && !this._toolWin.closed);
  }

  open() {
    if (!this._hostWindow || typeof this._hostWindow.open !== 'function') return false;

    // Must be called inside a user gesture to avoid popup blockers.
    this._toolWin = this._hostWindow.open(this._toolUrl, this._name, this._features);
    return Boolean(this._toolWin);
  }

  close() {
    try {
      if (this._toolWin && !this._toolWin.closed) this._toolWin.close();
    } catch (err) {
      if (this._log && typeof this._log.warn === 'function')
        this._log.warn('ToolWindowPostMessageAdapter close failed', err);
    }
    this._toolWin = null;
  }

  /**
   * Send a message to the tool window.
   * @param {any} msg
   */
  send(msg) {
    if (!this._toolWin || this._toolWin.closed) return false;
    try {
      this._toolWin.postMessage(msg, this._toolOrigin);
      return true;
    } catch (err) {
      if (this._log && typeof this._log.warn === 'function')
        this._log.warn('ToolWindowPostMessageAdapter postMessage failed', err);
      return false;
    }
  }
}
