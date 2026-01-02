import { buildLanguageDomTree } from './language-dom-tree.js';

function nowMs() {
  return Date.now();
}

/**
 * LanguageDomTreeSystem
 *
 * Listens for requests to build a language DOM tree from a webhint feed.
 *
 * Events:
 * - emit { channel:'WEBHINT', type:'LOAD_FEED', payload:{ url, hintReportOnly?: boolean } }
 * - emits { channel:'WEBHINT', type:'LDOM_UPDATED', payload:{ url, tree, counts }, atMs }
 * - emits { channel:'WEBHINT', type:'LDOM_ERROR', payload:{ url, error }, atMs }
 */
export class LanguageDomTreeSystem {
  constructor(opts = {}) {
    this.name = 'LanguageDomTreeSystem';
    this.bus = opts.bus;
    this.log = opts.logger || console;
    this._unsub = null;
  }

  start(engine) {
    if (engine && engine.bus) this.bus = engine.bus;
    if (!this.bus || typeof this.bus.subscribe !== 'function') return;

    this._unsub = this.bus.subscribe('WEBHINT', (event) => {
      if (!event || event.type !== 'LOAD_FEED') return;
      const payload = event.payload || {};
      const url = payload.url;
      const hintReportOnly = payload.hintReportOnly !== false;
      if (typeof url !== 'string' || !url) return;
      this.loadFromUrl(url, { hintReportOnly });
    });
  }

  stop() {
    if (this._unsub) this._unsub();
    this._unsub = null;
  }

  async loadFromUrl(url, opts = {}) {
    const hintReportOnly = opts.hintReportOnly !== false;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load feed: ${res.status}`);
      const feed = await res.json();

      const entries = Array.isArray(feed.entries) ? feed.entries : [];
      const filtered = hintReportOnly
        ? entries.filter((e) => String(e.path || '').startsWith('hint-report/'))
        : entries;

      const tree = buildLanguageDomTree(filtered.slice(0, 500), { maxDepth: 7 });

      if (this.bus && typeof this.bus.emit === 'function') {
        this.bus.emit({
          channel: 'WEBHINT',
          type: 'LDOM_UPDATED',
          payload: {
            url,
            tree,
            counts: {
              totalEntries: entries.length,
              hintReportEntries: filtered.length,
            },
            generatedAt: feed.generatedAt || null,
          },
          atMs: nowMs(),
        });
      }

      return { ok: true, tree };
    } catch (e) {
      const message = String(e && e.message ? e.message : e);
      try {
        if (this.bus && typeof this.bus.emit === 'function') {
          this.bus.emit({
            channel: 'WEBHINT',
            type: 'LDOM_ERROR',
            payload: { url, error: message },
            atMs: nowMs(),
          });
        }
      } catch {
        // ignore
      }
      if (this.log && typeof this.log.warn === 'function')
        this.log.warn('LanguageDomTreeSystem load failed', message);
      return { ok: false, error: message };
    }
  }
}
