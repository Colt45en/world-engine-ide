import { getBus } from '../bus/bus';

/** @typedef {'models'|'textures'|'audio'|'materials'|'shaders'|'config'} AssetType */
/** @typedef {'queued'|'loading'|'loaded'|'error'|'evicted'} AssetStatus */

/**
 * @typedef {Object} AssetRecord
 * @property {AssetType} assetType
 * @property {string} id
 * @property {string} path
 * @property {AssetStatus} status
 * @property {number} progress
 * @property {number} sizeMB
 * @property {string|null} error
 * @property {number} lastAccessMs
 * @property {number} lastUpdateMs
 * @property {any|null} value
 */

function nowMs() {
  return Date.now();
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function key(assetType, id) {
  return `${assetType}:${id}`;
}

function estimateTextureMB(value) {
  const img = value && value.image ? value.image : null;
  const w = img && typeof img.width === 'number' ? img.width : 1024;
  const h = img && typeof img.height === 'number' ? img.height : 1024;
  return (w * h * 4) / (1024 * 1024);
}

function estimateModelMB(value) {
  let bytes = 0;
  const scene = value && value.scene ? value.scene : value;

  if (!scene || typeof scene.traverse !== 'function') return 0;

  scene.traverse((obj) => {
    const geo = obj && obj.geometry ? obj.geometry : null;
    if (!geo || !geo.attributes) return;

    for (const name of Object.keys(geo.attributes)) {
      const a = geo.attributes[name];
      bytes += a && a.array && a.array.byteLength ? a.array.byteLength : 0;
    }

    if (geo.index && geo.index.array && geo.index.array.byteLength)
      bytes += geo.index.array.byteLength;
  });

  return bytes / (1024 * 1024);
}

function estimateAudioMB(value) {
  const ch = value && typeof value.numberOfChannels === 'number' ? value.numberOfChannels : 2;
  const len = value && typeof value.length === 'number' ? value.length : 44100 * 5;
  return (len * ch * 4) / (1024 * 1024);
}

class PriorityQueue {
  constructor() {
    /** @type {Array<any>} */
    this.arr = [];
  }
  push(item) {
    this.arr.push(item);
    this.arr.sort((a, b) => b.priority - a.priority);
  }
  shift() {
    return this.arr.shift() || null;
  }
  get length() {
    return this.arr.length;
  }
}

/**
 * R3F-friendly asset resource manager.
 * - Concurrency-limited request queue
 * - LRU eviction with a soft memory budget (estimated)
 * - Emits events on the in-memory bus (channel: 'ASSET')
 */
export class AssetResourceManagerR3F {
  /**
   * @param {{
   *  basePaths?: Record<string,string>,
   *  memoryLimitMB?: number,
   *  maxConcurrentLoads?: number,
   *  loaders: Record<string, (path:string, onProgress?:(p:number)=>void, options?:any)=>Promise<any>>,
   *  estimators?: Record<string, (value:any, options?:any)=>number>,
   *  maxRecords?: number,
   *  bus?: ReturnType<typeof getBus>,
   * }} cfg
   */
  constructor(cfg) {
    this.basePaths = cfg.basePaths ?? {
      models: 'assets/models',
      textures: 'assets/textures',
      audio: 'assets/audio',
      materials: 'assets/materials',
      shaders: 'assets/shaders',
      config: 'assets/config',
    };

    this.memoryLimitMB = Number.isFinite(cfg.memoryLimitMB) ? cfg.memoryLimitMB : 512;
    this.maxConcurrentLoads = Math.max(
      1,
      Number.isFinite(cfg.maxConcurrentLoads) ? cfg.maxConcurrentLoads : 4,
    );
    this.maxRecords = Math.max(50, Number.isFinite(cfg.maxRecords) ? cfg.maxRecords : 500);

    this.loaders = cfg.loaders;
    this.estimators = cfg.estimators ?? {};

    this.bus = cfg.bus ?? getBus();

    this.queue = new PriorityQueue();
    this.inFlight = 0;

    /** @type {Map<string, AssetRecord>} */
    this.records = new Map();

    /** @type {Map<string, Promise<any>>} */
    this.pending = new Map();
  }

  fullPath(assetType, id) {
    const base = this.basePaths[assetType] ?? '';
    return `${base}/${id}`;
  }

  /**
   * Request an asset. Returns a Promise that resolves to the loaded value.
   * @param {AssetType} assetType
   * @param {string} id
   * @param {number} priority
   * @param {any} options
   */
  request(assetType, id, priority = 0, options = {}) {
    const K = key(assetType, id);
    const path = this.fullPath(assetType, id);

    const existing = this.records.get(K);
    if (existing && existing.status === 'loaded' && existing.value != null) {
      existing.lastAccessMs = nowMs();
      this._emit('LOADED', {
        assetType,
        id,
        path,
        progress: 1,
        fromCache: true,
        sizeMB: existing.sizeMB,
        memory: this.memoryStats(),
      });
      return Promise.resolve(existing.value);
    }

    const pend = this.pending.get(K);
    if (pend) return pend;

    const rec = existing ?? this._ensureRecord(assetType, id, path);
    rec.status = 'queued';
    rec.progress = 0;
    rec.error = null;
    rec.lastUpdateMs = nowMs();
    rec.lastAccessMs = rec.lastUpdateMs;

    this._emit('REQUEST', { assetType, id, path, priority, memory: this.memoryStats() });

    const p = new Promise((resolve, reject) => {
      this.queue.push({ assetType, id, path, priority, options, resolve, reject });
      this._pump();
    });

    this.pending.set(K, p);
    return p;
  }

  /** @returns {{ memoryLimitMB:number, totalMB:number, percentUsed:number, inFlight:number, queued:number, counts:Record<string,number> }} */
  memoryStats() {
    /** @type {Record<string,number>} */
    const counts = {};
    let total = 0;
    for (const rec of this.records.values()) {
      const loaded = rec.status === 'loaded';
      counts[rec.assetType] = (counts[rec.assetType] ?? 0) + (loaded ? 1 : 0);
      if (loaded) total += rec.sizeMB;
    }

    return {
      memoryLimitMB: this.memoryLimitMB,
      totalMB: total,
      percentUsed: this.memoryLimitMB > 0 ? (total / this.memoryLimitMB) * 100 : 0,
      inFlight: this.inFlight,
      queued: this.queue.length,
      counts,
    };
  }

  /** @returns {AssetRecord | null} */
  getRecord(assetType, id) {
    return this.records.get(key(assetType, id)) ?? null;
  }

  /** INTERNALS */

  _emit(type, payload) {
    this.bus.emit({ channel: 'ASSET', type, payload, atMs: nowMs() });
  }

  _ensureRecord(assetType, id, path) {
    const K = key(assetType, id);

    /** @type {AssetRecord} */
    const rec = {
      assetType,
      id,
      path,
      status: 'queued',
      progress: 0,
      sizeMB: 0,
      error: null,
      lastAccessMs: nowMs(),
      lastUpdateMs: nowMs(),
      value: null,
    };

    this.records.set(K, rec);

    if (this.records.size > this.maxRecords) {
      this._evictOldestRecords(this.records.size - this.maxRecords);
    }

    return rec;
  }

  _pump() {
    while (this.inFlight < this.maxConcurrentLoads && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      this._startJob(job);
    }
  }

  async _startJob(job) {
    const { assetType, id, path, options, resolve, reject } = job;
    const K = key(assetType, id);

    const loader = this.loaders[assetType];
    if (!loader) {
      const err = `No loader registered for "${assetType}"`;
      this._markError(assetType, id, path, err);
      this.pending.delete(K);
      reject(new Error(err));
      return;
    }

    const rec = this._ensureRecord(assetType, id, path);
    rec.status = 'loading';
    rec.progress = 0;
    rec.error = null;
    rec.lastUpdateMs = nowMs();

    this._emit('START', { assetType, id, path, memory: this.memoryStats() });

    this.inFlight += 1;

    try {
      const value = await loader(
        path,
        (p) => {
          const rr = this.records.get(K);
          if (!rr) return;
          rr.progress = clamp01(p);
          rr.lastUpdateMs = nowMs();
          this._emit('PROGRESS', {
            assetType,
            id,
            path,
            progress: rr.progress,
            memory: this.memoryStats(),
          });
        },
        options,
      );

      const sizeMB = this._estimateMB(assetType, value, options);

      rec.value = value;
      rec.sizeMB = sizeMB;
      rec.status = 'loaded';
      rec.progress = 1;
      rec.error = null;
      rec.lastAccessMs = nowMs();
      rec.lastUpdateMs = rec.lastAccessMs;

      this._emit('LOADED', {
        assetType,
        id,
        path,
        progress: 1,
        fromCache: false,
        sizeMB,
        memory: this.memoryStats(),
      });

      this._maybeEvictLRU(assetType);

      resolve(value);
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      this._markError(assetType, id, path, msg);
      reject(e);
    } finally {
      this.inFlight -= 1;
      this.pending.delete(K);
      this._pump();
    }
  }

  _markError(assetType, id, path, error) {
    const rec = this._ensureRecord(assetType, id, path);
    rec.status = 'error';
    rec.error = error;
    rec.lastUpdateMs = nowMs();
    this._emit('ERROR', { assetType, id, path, error, memory: this.memoryStats() });
  }

  _estimateMB(assetType, value, options) {
    const est = this.estimators[assetType];
    if (est) return Math.max(0, est(value, options));

    if (assetType === 'textures') return estimateTextureMB(value);
    if (assetType === 'models') return estimateModelMB(value);
    if (assetType === 'audio') return estimateAudioMB(value);

    return 1;
  }

  _totalLoadedMB() {
    let t = 0;
    for (const rec of this.records.values()) {
      if (rec.status === 'loaded') t += rec.sizeMB;
    }
    return t;
  }

  _maybeEvictLRU(primaryType) {
    const total = this._totalLoadedMB();
    if (total <= this.memoryLimitMB) return;

    this._emit('MEMORY_WARNING', {
      memoryMBTotal: total,
      memoryLimitMB: this.memoryLimitMB,
      memory: this.memoryStats(),
    });

    const target = this.memoryLimitMB * 0.8;

    const items = Array.from(this.records.entries())
      .filter(([, r]) => r.status === 'loaded')
      .sort((a, b) => a[1].lastAccessMs - b[1].lastAccessMs);

    for (const [K, r] of items) {
      if (this._totalLoadedMB() <= target) break;
      if (r.assetType === primaryType) continue;

      r.status = 'evicted';
      r.value = null;
      r.progress = 0;
      r.error = null;
      r.lastUpdateMs = nowMs();

      this._emit('EVICTED', {
        key: K,
        assetType: r.assetType,
        id: r.id,
        sizeMB: r.sizeMB,
        memoryMBTotal: this._totalLoadedMB(),
        memory: this.memoryStats(),
      });
    }
  }

  _evictOldestRecords(count) {
    if (count <= 0) return;
    const items = Array.from(this.records.entries()).sort(
      (a, b) => a[1].lastUpdateMs - b[1].lastUpdateMs,
    );

    for (let i = 0; i < Math.min(count, items.length); i += 1) {
      const [K] = items[i];
      this.records.delete(K);
    }
  }
}
