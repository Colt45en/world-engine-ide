import {
  getWowLiteTargetOrigin,
  parseWowLiteMessageFromIframe,
} from '../../control-plane/wowLiteProtocol';

export class WowLitePostMessageAdapter {
  /**
   * @param {{ iframeRef: any, hostWindow?: any }} opts
   */
  constructor(opts) {
    this._iframeRef = opts.iframeRef;
    this._hostWindow = opts.hostWindow || globalThis;
    this._gateway = null;

    this._onMessage = (event) => {
      const msg = parseWowLiteMessageFromIframe(event, this._iframeRef);
      if (!msg) return;
      if (this._gateway) this._gateway.onTransportMessage('transport.pm.wowLite', msg);
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

  /**
   * Send a message to the WoW-Lite iframe.
   * @param {any} msg
   */
  send(msg) {
    const iframe = this._iframeRef && this._iframeRef.current;
    const iframeWin = iframe && iframe.contentWindow ? iframe.contentWindow : null;
    if (!iframeWin) return false;

    const targetOrigin = getWowLiteTargetOrigin(this._iframeRef);
    iframeWin.postMessage(msg, targetOrigin);
    return true;
  }
}
