/**
 * Minimal in-memory event bus.
 *
 * Contract:
 * - emit({ channel, type, payload, atMs })
 * - subscribe(channel, handler) -> unsubscribe()
 */

/** @typedef {'MATH'|'PLACEMENT'|'PHYSICS'|'RENDER'|'TELEMETRY'|'UI'|'ASSET'|'WEBHINT'} BusChannel */

/**
 * @typedef {Object} BusEvent
 * @property {string} id
 * @property {BusChannel} channel
 * @property {string} type
 * @property {number} seq
 * @property {unknown} payload
 * @property {number} atMs
 */

/** @typedef {(event: BusEvent) => void} BusHandler */

function nowMs() {
  return Date.now();
}

/**
 * @returns {{
 *   emit: (event: Omit<BusEvent,'atMs'> & Partial<Pick<BusEvent,'atMs'>>) => void,
 *   subscribe: (channel: BusChannel, handler: BusHandler) => () => void,
 * }}
 */
export function createBus() {
  /** @type {Map<BusChannel, Set<BusHandler>>} */
  const handlersByChannel = new Map();

  /** @type {Map<BusChannel, number>} */
  const seqByChannel = new Map();

  let globalIdCounter = 0;

  /** @param {BusChannel} channel */
  function nextSeq(channel) {
    const prev = seqByChannel.get(channel) || 0;
    const next = prev + 1;
    seqByChannel.set(channel, next);
    return next;
  }

  function nextId(atMs) {
    globalIdCounter += 1;
    return `${atMs.toString(36)}-${globalIdCounter.toString(36)}`;
  }

  /** @param {BusChannel} channel */
  function setFor(channel) {
    let set = handlersByChannel.get(channel);
    if (!set) {
      set = new Set();
      handlersByChannel.set(channel, set);
    }
    return set;
  }

  return {
    emit(event) {
      if (!event || typeof event !== 'object') return;
      const channel = /** @type {any} */ (event).channel;
      const type = /** @type {any} */ (event).type;
      if (typeof channel !== 'string' || typeof type !== 'string') return;

      const atMs =
        typeof (/** @type {any} */ (event).atMs) === 'number'
          ? /** @type {any} */ (event).atMs
          : nowMs();

      const id =
        typeof (/** @type {any} */ (event).id) === 'string'
          ? /** @type {any} */ (event).id
          : nextId(atMs);
      const seq =
        typeof (/** @type {any} */ (event).seq) === 'number'
          ? /** @type {any} */ (event).seq
          : nextSeq(/** @type {BusChannel} */ (channel));

      /** @type {BusEvent} */
      const e = {
        id,
        channel: /** @type {BusChannel} */ (channel),
        type,
        seq,
        payload: /** @type {any} */ (event).payload,
        atMs,
      };

      const set = handlersByChannel.get(e.channel);
      if (!set || set.size === 0) return;

      for (const handler of Array.from(set)) {
        try {
          handler(e);
        } catch {
          // Never let a handler break the bus.
        }
      }
    },

    subscribe(channel, handler) {
      if (typeof channel !== 'string' || typeof handler !== 'function') return () => {};
      const set = setFor(channel);
      set.add(handler);
      return () => {
        try {
          set.delete(handler);
        } catch {
          // ignore
        }
      };
    },
  };
}

/** @type {ReturnType<typeof createBus> | null} */
let singleton = null;

/** @returns {ReturnType<typeof createBus>} */
export function getBus() {
  if (!singleton) singleton = createBus();
  return singleton;
}
