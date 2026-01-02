import PropTypes from 'prop-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useHistory } from 'react-router-dom';
import { getBus } from '../bus/bus';
import {
  createDefaultObservability,
  mergeObservability,
} from '../control-plane/observabilityContract';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function safeAtMs(e) {
  return e && typeof e.atMs === 'number' ? e.atMs : Date.now();
}

function safeSeq(e) {
  return e && typeof e.seq === 'number' ? e.seq : null;
}

function channelSeqKey(channel) {
  if (channel === 'MATH') return 'mathLastSeq';
  if (channel === 'PLACEMENT') return 'placementLastSeq';
  if (channel === 'UI') return 'uiLastSeq';
  if (channel === 'ASSET') return 'assetLastSeq';
  return 'physicsLastSeq';
}

function channelAtKey(channel) {
  if (channel === 'MATH') return 'mathLastAtMs';
  if (channel === 'PLACEMENT') return 'placementLastAtMs';
  if (channel === 'UI') return 'uiLastAtMs';
  if (channel === 'ASSET') return 'assetLastAtMs';
  return 'physicsLastAtMs';
}

function channelHandlers(channel) {
  if (channel === 'MATH') return MATH_HANDLERS;
  if (channel === 'PLACEMENT') return PLACEMENT_HANDLERS;
  if (channel === 'UI') return UI_HANDLERS;
  if (channel === 'ASSET') return ASSET_HANDLERS;
  return null;
}

function safePayload(e) {
  return isPlainObject(e && e.payload) ? e.payload : null;
}

function safePlacementAnchorSummary(e) {
  const payload = safePayload(e);
  if (!payload) return null;
  if (typeof payload.accepted !== 'boolean' || payload.accepted !== true) return null;
  const cell = payload.cell;
  if (!isPlainObject(cell)) return null;
  if (!Number.isInteger(cell.i) || !Number.isInteger(cell.k)) return null;

  const kind = typeof payload.kind === 'string' ? payload.kind : null;
  const face = typeof payload.face === 'string' ? payload.face : null;
  if (!kind) return null;

  return {
    kind,
    cell: [cell.i, cell.k],
    face,
  };
}

function mergePlacementAnchors(prevAnchors, nextAnchor, limit = 200) {
  const prev = Array.isArray(prevAnchors) ? prevAnchors : [];
  if (!nextAnchor) return prev;

  const key = `${nextAnchor.kind}|${nextAnchor.cell[0]}|${nextAnchor.cell[1]}|${nextAnchor.face || ''}`;
  const out = [];
  let seen = false;

  for (const a of prev) {
    if (!a || !Array.isArray(a.cell) || a.cell.length !== 2) continue;
    const k = `${a.kind}|${a.cell[0]}|${a.cell[1]}|${a.face || ''}`;
    if (k === key) {
      if (!seen) {
        out.push(nextAnchor);
        seen = true;
      }
      continue;
    }
    out.push(a);
    if (out.length >= limit) break;
  }

  if (!seen) out.unshift(nextAnchor);
  return out.slice(0, limit);
}

const MATH_HANDLERS = {
  FIELD_SAMPLE: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    return {
      mathLastFieldSampleAtMs: atMs,
      mathLastHeight: typeof payload.height === 'number' ? payload.height : null,
      mathLastNormal: isPlainObject(payload.normal) ? payload.normal : null,
      mathLastEnergy: typeof payload.energy === 'number' ? payload.energy : null,
    };
  },

  ORIENTATION: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    return {
      mathLastOrientationAtMs: atMs,
      mathLastFace: typeof payload.face === 'string' ? payload.face : null,
      mathLastSpinRad: typeof payload.spinRad === 'number' ? payload.spinRad : null,
      mathLastQuaternion: Array.isArray(payload.quaternion) ? payload.quaternion : null,
    };
  },
};

const PLACEMENT_HANDLERS = {
  GRID_SNAP: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    return {
      placementLastGridSnapAtMs: atMs,
      placementLastCell: isPlainObject(payload.cell) ? payload.cell : null,
      placementLastCubeSize: typeof payload.cubeSize === 'number' ? payload.cubeSize : null,
    };
  },

  FACE_RESOLVE: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    return {
      placementLastFaceResolveAtMs: atMs,
      placementLastResolvedFace: typeof payload.face === 'string' ? payload.face : null,
    };
  },

  ANCHOR_COMMIT: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    return {
      placementLastAnchorCommitAtMs: atMs,
      placementLastAnchorKind: typeof payload.kind === 'string' ? payload.kind : null,
      placementLastAnchorCell: isPlainObject(payload.cell) ? payload.cell : null,
      placementLastAnchorFace: typeof payload.face === 'string' ? payload.face : null,
      placementLastAnchorAccepted: typeof payload.accepted === 'boolean' ? payload.accepted : false,
      placementLastAnchorReason: typeof payload.reason === 'string' ? payload.reason : null,
    };
  },
};

const UI_HANDLERS = {
  MINIMAP_PING: (e) => {
    const atMs = safeAtMs(e);
    return { uiLastPingAtMs: atMs };
  },

  MINIMAP_ZOOM: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;
    return {
      uiLastAtMs: atMs,
      uiMinimapZoom: typeof payload.zoom === 'number' ? payload.zoom : null,
    };
  },

  SET_TELEMETRY_ENABLED: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;
    return {
      uiLastAtMs: atMs,
      uiTelemetryEnabled: typeof payload.enabled === 'boolean' ? payload.enabled : true,
    };
  },

  INVENTORY_SORT: (e) => {
    const atMs = safeAtMs(e);
    return { uiLastInventorySortAtMs: atMs };
  },
};

function clamp01(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function isAssetStatus(v) {
  return v === 'queued' || v === 'loading' || v === 'loaded' || v === 'error' || v === 'evicted';
}

function safeAssetKey(payload) {
  if (!payload) return null;
  const assetType = typeof payload.assetType === 'string' ? payload.assetType : null;
  const id = typeof payload.id === 'string' ? payload.id : null;
  if (!assetType || !id) return null;
  return `${assetType}:${id}`;
}

function safeAssetSummaryFromPayload(payload, fallbackStatus) {
  const k = safeAssetKey(payload);
  if (!k) return null;

  const status =
    typeof payload.status === 'string' && isAssetStatus(payload.status)
      ? payload.status
      : fallbackStatus;
  const progress = clamp01(typeof payload.progress === 'number' ? payload.progress : 0);
  const sizeMB =
    typeof payload.sizeMB === 'number' && Number.isFinite(payload.sizeMB)
      ? Math.max(0, payload.sizeMB)
      : 0;
  const lastUpdateMs =
    typeof payload.atMs === 'number' && Number.isFinite(payload.atMs) ? payload.atMs : Date.now();
  const error = typeof payload.error === 'string' ? payload.error : null;
  const path = typeof payload.path === 'string' ? payload.path : null;
  const fromCache = typeof payload.fromCache === 'boolean' ? payload.fromCache : false;

  return {
    key: k,
    status,
    progress,
    sizeMB,
    lastUpdateMs,
    error,
    fromCache,
    assetType: payload.assetType,
    id: payload.id,
    path,
  };
}

function readFiniteNumber(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function safeAssetsMemory(payload) {
  const mem =
    payload && typeof payload.memory === 'object' && payload.memory !== null
      ? payload.memory
      : null;
  if (!mem) return null;

  const memoryLimitMB = readFiniteNumber(mem, 'memoryLimitMB');
  const totalMB = readFiniteNumber(mem, 'totalMB');
  const percentUsed = readFiniteNumber(mem, 'percentUsed');
  const inFlight = readFiniteNumber(mem, 'inFlight');
  const queued = readFiniteNumber(mem, 'queued');
  const counts =
    typeof mem.counts === 'object' && mem.counts !== null && !Array.isArray(mem.counts)
      ? mem.counts
      : null;

  if (
    memoryLimitMB === null ||
    totalMB === null ||
    percentUsed === null ||
    inFlight === null ||
    queued === null ||
    counts === null
  )
    return null;

  return { memoryLimitMB, totalMB, percentUsed, inFlight, queued, counts };
}

function mergeAssetsByKey(prev, nextItem, limit = 250) {
  const base = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {};
  if (!nextItem || !nextItem.key) return base;

  const out = { ...base, [nextItem.key]: nextItem };

  const keys = Object.keys(out);
  if (keys.length <= limit) return out;

  keys.sort((a, b) => {
    const av = out[a];
    const bv = out[b];
    const aa = av && typeof av.lastUpdateMs === 'number' ? av.lastUpdateMs : 0;
    const bb = bv && typeof bv.lastUpdateMs === 'number' ? bv.lastUpdateMs : 0;
    return bb - aa;
  });

  const pruned = {};
  for (let i = 0; i < Math.min(limit, keys.length); i += 1) {
    const k = keys[i];
    pruned[k] = out[k];
  }
  return pruned;
}

function mergeRecentList(prev, item, limit = 25) {
  const base = Array.isArray(prev) ? prev : [];
  if (!item) return base;
  const next = [item, ...base];
  return next.slice(0, limit);
}

const ASSET_HANDLERS = {
  REQUEST: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    const nextItem = safeAssetSummaryFromPayload({ ...payload, atMs, status: 'queued' }, 'queued');
    const mem = safeAssetsMemory(payload);
    const memPatch = mem ? { ...mem, lastUpdateMs: atMs } : null;
    const key = safeAssetKey(payload);

    return {
      assetsLastEventAtMs: atMs,
      assetsLastEventType: 'REQUEST',
      ...(key ? { assetsLastEventKey: key } : {}),
      ...(memPatch ? { assetsMemory: memPatch } : {}),
      ...(nextItem ? { assetsByKeyItem: nextItem } : {}),
    };
  },

  START: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    const nextItem = safeAssetSummaryFromPayload(
      { ...payload, atMs, status: 'loading' },
      'loading',
    );
    const mem = safeAssetsMemory(payload);
    const memPatch = mem ? { ...mem, lastUpdateMs: atMs } : null;
    const key = safeAssetKey(payload);

    return {
      assetsLastEventAtMs: atMs,
      assetsLastEventType: 'START',
      ...(key ? { assetsLastEventKey: key } : {}),
      ...(memPatch ? { assetsMemory: memPatch } : {}),
      ...(nextItem ? { assetsByKeyItem: nextItem } : {}),
    };
  },

  PROGRESS: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    const nextItem = safeAssetSummaryFromPayload(
      { ...payload, atMs, status: 'loading' },
      'loading',
    );
    const mem = safeAssetsMemory(payload);
    const memPatch = mem ? { ...mem, lastUpdateMs: atMs } : null;
    const key = safeAssetKey(payload);

    return {
      assetsLastEventAtMs: atMs,
      assetsLastEventType: 'PROGRESS',
      ...(key ? { assetsLastEventKey: key } : {}),
      ...(memPatch ? { assetsMemory: memPatch } : {}),
      ...(nextItem ? { assetsByKeyItem: nextItem } : {}),
    };
  },

  LOADED: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    const nextItem = safeAssetSummaryFromPayload({ ...payload, atMs, status: 'loaded' }, 'loaded');
    const mem = safeAssetsMemory(payload);
    const memPatch = mem ? { ...mem, lastUpdateMs: atMs } : null;
    const key = safeAssetKey(payload);

    return {
      assetsLastEventAtMs: atMs,
      assetsLastEventType: 'LOADED',
      ...(key ? { assetsLastEventKey: key } : {}),
      ...(memPatch ? { assetsMemory: memPatch } : {}),
      ...(nextItem ? { assetsByKeyItem: nextItem } : {}),
    };
  },

  ERROR: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    const nextItem = safeAssetSummaryFromPayload({ ...payload, atMs, status: 'error' }, 'error');
    const mem = safeAssetsMemory(payload);
    const memPatch = mem ? { ...mem, lastUpdateMs: atMs } : null;
    const key = safeAssetKey(payload);
    const errItem = nextItem
      ? {
          atMs,
          key: nextItem.key,
          assetType: typeof nextItem.assetType === 'string' ? nextItem.assetType : '',
          id: typeof nextItem.id === 'string' ? nextItem.id : '',
          path: typeof nextItem.path === 'string' ? nextItem.path : null,
          error: nextItem.error || 'Unknown error',
        }
      : null;

    return {
      assetsLastEventAtMs: atMs,
      assetsLastEventType: 'ERROR',
      ...(key ? { assetsLastEventKey: key } : {}),
      ...(memPatch ? { assetsMemory: memPatch } : {}),
      ...(nextItem ? { assetsByKeyItem: nextItem } : {}),
      ...(errItem ? { assetsRecentErrorsItem: errItem } : {}),
    };
  },

  EVICTED: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    const mem = safeAssetsMemory(payload);
    const memPatch = mem ? { ...mem, lastUpdateMs: atMs } : null;
    const evKey = typeof payload.key === 'string' ? payload.key : safeAssetKey(payload);
    const ev = {
      atMs,
      key: typeof evKey === 'string' ? evKey : '',
      assetType: typeof payload.assetType === 'string' ? payload.assetType : '',
      id: typeof payload.id === 'string' ? payload.id : '',
      sizeMB:
        typeof payload.sizeMB === 'number' && Number.isFinite(payload.sizeMB) ? payload.sizeMB : 0,
      memoryMBTotal:
        typeof payload.memoryMBTotal === 'number' && Number.isFinite(payload.memoryMBTotal)
          ? payload.memoryMBTotal
          : 0,
    };

    return {
      assetsLastEventAtMs: atMs,
      assetsLastEventType: 'EVICTED',
      ...(evKey ? { assetsLastEventKey: evKey } : {}),
      ...(memPatch ? { assetsMemory: memPatch } : {}),
      ...(ev.key ? { assetsRecentEvictionsItem: ev } : {}),
    };
  },

  MEMORY_WARNING: (e) => {
    const atMs = safeAtMs(e);
    const payload = safePayload(e);
    if (!payload) return;

    const mem = safeAssetsMemory(payload);
    const memPatch = mem ? { ...mem, lastUpdateMs: atMs } : null;
    return {
      assetsLastEventAtMs: atMs,
      assetsLastEventType: 'MEMORY_WARNING',
      ...(memPatch ? { assetsMemory: memPatch } : {}),
    };
  },
};

function applyPlacementPatch(prev, channel, e, patch) {
  if (channel !== 'PLACEMENT' || !e || e.type !== 'ANCHOR_COMMIT') return patch;

  const nextAnchor = safePlacementAnchorSummary(e);
  if (!nextAnchor) return patch;

  return {
    ...patch,
    placementAnchors: mergePlacementAnchors(prev.placementAnchors, nextAnchor, 200),
  };
}

function applyAssetPatch(prev, channel, patch, details) {
  if (channel !== 'ASSET') return patch;

  const next = { ...patch };

  const item = details && details.assetsByKeyItem ? details.assetsByKeyItem : null;
  if (item) next.assetsByKey = mergeAssetsByKey(prev.assetsByKey, item, 400);

  const errItem = details && details.assetsRecentErrorsItem ? details.assetsRecentErrorsItem : null;
  if (errItem) next.assetsRecentErrors = mergeRecentList(prev.assetsRecentErrors, errItem, 10);

  const evItem =
    details && details.assetsRecentEvictionsItem ? details.assetsRecentEvictionsItem : null;
  if (evItem) next.assetsRecentEvictions = mergeRecentList(prev.assetsRecentEvictions, evItem, 25);

  if (details && details.assetsLastEventType === 'MEMORY_WARNING') {
    const prevWarnings = typeof prev.assetsWarnings === 'number' ? prev.assetsWarnings : 0;
    next.assetsWarnings = prevWarnings + 1;
  }

  return next;
}

function applyBusEventToObservability(prev, channel, e) {
  if (!shouldApplyMonotonic(prev, channel, e)) return prev;

  const envelope = busEnvelopePatch(channel, e);
  const handlers = channelHandlers(channel);
  const details = handlers ? buildHandlerPatch(handlers, e) : null;
  const basePatch = details ? { ...envelope, ...details } : envelope;

  const withAssets = applyAssetPatch(prev, channel, basePatch, details);
  const withPlacement = applyPlacementPatch(prev, channel, e, withAssets);

  return mergeObservability(prev, withPlacement);
}

function buildHandlerPatch(handlers, e) {
  if (!e || typeof e !== 'object') return null;
  const handler = handlers[e.type];
  if (typeof handler !== 'function') return null;
  return handler(e) || null;
}

function busEnvelopePatch(channel, e) {
  const atMs = safeAtMs(e);
  const seq = safeSeq(e);

  const seqKey = channelSeqKey(channel);
  const atKey = channelAtKey(channel);

  return {
    busLastAtMs: atMs,
    busLastId: typeof e.id === 'string' ? e.id : null,
    busLastChannel: channel,
    busLastType: typeof e.type === 'string' ? e.type : null,
    ...(typeof seq === 'number' ? { busLastSeq: seq, [seqKey]: seq } : {}),
    [atKey]: atMs,
  };
}

function shouldApplyMonotonic(prev, channel, e) {
  const atMs = safeAtMs(e);
  const seq = safeSeq(e);

  const prevSeq = prev[channelSeqKey(channel)];
  const prevAtMs = prev[channelAtKey(channel)];

  if (typeof seq === 'number') {
    if (seq > prevSeq) return true;
    if (seq < prevSeq) return false;
    return atMs >= prevAtMs;
  }

  return atMs >= prevAtMs;
}

export const MATH_ROUTER_SCHEMA_VERSION = 1;
const STORAGE_KEY = 'world-engine.mathRouter.v1';
const PAYLOAD_TTL_MS = 30 * 60 * 1000;

function loadInitialFromSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { payload: null, payloadId: null, staleCleared: false };
    const parsed = JSON.parse(raw);
    const payload = parsed && typeof parsed === 'object' ? parsed.payload : null;
    const payloadId =
      parsed && typeof parsed === 'object' && typeof parsed.payloadId === 'string'
        ? parsed.payloadId
        : null;

    if (payload && typeof payload.createdAtMs === 'number') {
      const ageMs = Date.now() - payload.createdAtMs;
      if (ageMs > PAYLOAD_TTL_MS) {
        const next = { payload: null, payloadId: null };
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return { payload: null, payloadId: null, staleCleared: true };
      }
    }

    return { payload: payload || null, payloadId, staleCleared: false };
  } catch {
    return { payload: null, payloadId: null, staleCleared: false };
  }
}

/**
 * @typedef {Object} MathPayload
 * @property {number} schemaVersion
 * @property {string} expression
 * @property {Record<string, number>} variables
 * @property {number} result
 * @property {number} createdAtMs
 * @property {'diagnostic'} source
 */

const MathRouterContext = createContext(null);

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MathRouterProvider({ children }) {
  const history = useHistory();
  const [state, setState] = useState(() => {
    const initial = loadInitialFromSession();
    return { payload: initial.payload, payloadId: initial.payloadId };
  });

  const [delivery, setDelivery] = useState(() => {
    const initial = loadInitialFromSession();
    return {
      phase: initial.staleCleared ? 'stale-cleared' : 'idle',
      ready: false,
      connection: 'disconnected',
      capabilities: null,

      targetParams: null,
      lastSentAtMs: 0,
      lastSentRevision: -1,
      lastSentParams: null,

      lastAppliedAtMs: 0,
      lastRevisionApplied: -1,
      lastAppliedParams: null,

      clampDelta: null,
      lastError: initial.staleCleared ? 'Stale payload cleared (TTL)' : null,
      latencyMs: null,
    };
  });

  const [observability, setObservability] = useState(() => {
    return createDefaultObservability();
  });

  const consumedIds = useRef(new Set());

  const setPayload = useCallback((payload) => {
    if (!payload) {
      const next = { payload: null, payloadId: null };
      setState(next);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return;
    }

    const next = { payload, payloadId: makeId() };
    setState(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const routeToGame = useCallback(
    (p) => {
      const payload = {
        schemaVersion: MATH_ROUTER_SCHEMA_VERSION,
        expression: p.expression,
        variables: p.variables,
        result: p.result,
        createdAtMs: typeof p.createdAtMs === 'number' ? p.createdAtMs : Date.now(),
        source: p.source || 'diagnostic',
      };

      const id = makeId();
      const next = { payload, payloadId: id };
      setState(next);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      history.push('/game');
    },
    [history],
  );

  const consumePayload = useCallback(() => {
    if (!state.payloadId || !state.payload) return null;
    if (consumedIds.current.has(state.payloadId)) return null;
    consumedIds.current.add(state.payloadId);
    return state.payload;
  }, [state.payload, state.payloadId]);

  const clear = useCallback(() => {
    const next = { payload: null, payloadId: null };
    setState(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const updateDelivery = useCallback((partial) => {
    setDelivery((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateObservability = useCallback((partial) => {
    setObservability((prev) => mergeObservability(prev, partial || {}));
  }, []);

  const applyBusEvent = useCallback((channel, e) => {
    if (!e || typeof e !== 'object') return;

    setObservability((prev) => applyBusEventToObservability(prev, channel, e));
  }, []);

  useEffect(() => {
    const bus = getBus();

    const unsubscribeMath = bus.subscribe('MATH', (e) => applyBusEvent('MATH', e));
    const unsubscribePlacement = bus.subscribe('PLACEMENT', (e) => applyBusEvent('PLACEMENT', e));
    const unsubscribePhysics = bus.subscribe('PHYSICS', (e) => applyBusEvent('PHYSICS', e));
    const unsubscribeUi = bus.subscribe('UI', (e) => applyBusEvent('UI', e));
    const unsubscribeAsset = bus.subscribe('ASSET', (e) => applyBusEvent('ASSET', e));

    return () => {
      unsubscribeMath();
      unsubscribePlacement();
      unsubscribePhysics();
      unsubscribeUi();
      unsubscribeAsset();
    };
  }, [applyBusEvent]);

  const value = useMemo(
    () => ({
      payload: state.payload,
      payloadId: state.payloadId,
      setPayload,
      routeToGame,
      consumePayload,
      clear,
      delivery,
      updateDelivery,
      observability,
      updateObservability,
    }),
    [
      state.payload,
      state.payloadId,
      setPayload,
      routeToGame,
      consumePayload,
      clear,
      delivery,
      updateDelivery,
      observability,
      updateObservability,
    ],
  );

  return <MathRouterContext.Provider value={value}>{children}</MathRouterContext.Provider>;
}

export function useMathRouter() {
  const ctx = useContext(MathRouterContext);
  if (!ctx) throw new Error('useMathRouter must be used within <MathRouterProvider>');
  return ctx;
}

MathRouterProvider.propTypes = {
  children: PropTypes.node,
};
