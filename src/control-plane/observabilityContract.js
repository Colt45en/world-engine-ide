/**
 * Observability Contract
 * - Never exposes undefined fields
 * - Supports safe partial updates
 * - Provides strict runtime validation
 *
 * Notes:
 * - This module is intentionally plain JS + JSDoc so it works in JS/TS projects.
 * - It includes a few extra fields already used in this codebase (e.g. stale flags).
 */

/** @typedef {'UNKNOWN'|'OK'|'LOW_FPS'|'HIGH_JITTER'|'STALE'} Health */

/** @typedef {{i:number,j:number,k:number}} GridCell */

/** @typedef {[number,number,number,number]} QuaternionArray */

/** @typedef {{kind:string,cell:[number,number],face?:string|null}} PlacementAnchorSummary */

/** @typedef {'idle'|'queued'|'loading'|'loaded'|'error'|'evicted'} AssetStatus */

/**
 * @typedef {Object} AssetSummary
 * @property {string} key
 * @property {string} assetType
 * @property {string} id
 * @property {string|null} path
 * @property {AssetStatus} status
 * @property {number} progress
 * @property {number} sizeMB
 * @property {string|null} error
 * @property {boolean} fromCache
 * @property {number} lastUpdateMs
 */

/**
 * @typedef {Object} AssetsMemory
 * @property {number} memoryLimitMB
 * @property {number} totalMB
 * @property {number} percentUsed
 * @property {number} inFlight
 * @property {number} queued
 * @property {Record<string, number>} counts
 * @property {number} lastUpdateMs
 */

/**
 * @typedef {Object} AssetErrorItem
 * @property {number} atMs
 * @property {string} key
 * @property {string} assetType
 * @property {string} id
 * @property {string|null} path
 * @property {string} error
 */

/**
 * @typedef {Object} AssetEvictionItem
 * @property {number} atMs
 * @property {string} key
 * @property {string} assetType
 * @property {string} id
 * @property {number} sizeMB
 * @property {number} memoryMBTotal
 */

/**
 * @typedef {Object} TelemetrySample
 * @property {number} measuredAtMs            // Host receive time (wall clock)
 * @property {number|null} sentAtMs           // Game-sent timestamp if provided
 * @property {number|null} fps
 * @property {number|null} dtMs
 * @property {number|null} frameTimeMs
 * @property {Object|null} appliedParams      // Echo from game, e.g. { moveSpeed: 6 }
 * @property {number|null} lastRevisionApplied
 * @property {{x:number,y:number,z:number}|null} position
 */

/**
 * @typedef {Object} StableStats
 * @property {number} computedAtMs            // Host compute time
 * @property {number|null} stableFps
 * @property {number|null} stableFrameTimeMs
 * @property {number|null} jitterMs
 * @property {Health} health
 */

/**
 * @typedef {Object} Observability
 * @property {number} lastTelemetryAtMs
 * @property {TelemetrySample|null} telemetry
 * @property {StableStats|null} stableStats
 * @property {number} stableSeq
 * @property {number|null} basedOnTelemetryAtMs
 * @property {number} lastStableSentAtMs
 * @property {number|null} stableComputeLagMs
 * @property {Health} health
 * @property {string[]} supportedTelemetryFields
 *
 * // Fields already used by the UI/staleness logic
 * @property {number} lastStableAtMs
 * @property {boolean} telemetryStale
 * @property {boolean} stableStale
 *
 * // Bus-routed math/placement summaries (authoritative in host diagnostics)
 * @property {number} busLastAtMs
 * @property {string|null} busLastId
 * @property {string|null} busLastChannel
 * @property {string|null} busLastType
 * @property {number} busLastSeq
 * @property {number} mathLastAtMs
 * @property {number} mathLastSeq
 * @property {number} placementLastAtMs
 * @property {number} placementLastSeq
 * @property {number} physicsLastAtMs
 * @property {number} physicsLastSeq
 * @property {number} uiLastAtMs
 * @property {number} uiLastSeq
 * @property {number} assetLastAtMs
 * @property {number} assetLastSeq
 *
 * // UI-driven settings (HUD -> bus -> control plane)
 * @property {boolean} uiTelemetryEnabled
 * @property {number|null} uiMinimapZoom
 * @property {number} uiLastPingAtMs
 * @property {number} uiLastInventorySortAtMs
 *
 * @property {number} mathLastFieldSampleAtMs
 * @property {number|null} mathLastHeight
 * @property {{x:number,y:number,z:number}|null} mathLastNormal
 * @property {number|null} mathLastEnergy
 *
 * @property {number} mathLastOrientationAtMs
 * @property {string|null} mathLastFace
 * @property {number|null} mathLastSpinRad
 * @property {QuaternionArray|null} mathLastQuaternion
 *
 * @property {number} placementLastGridSnapAtMs
 * @property {GridCell|null} placementLastCell
 * @property {number|null} placementLastCubeSize
 *
 * @property {number} placementLastFaceResolveAtMs
 * @property {string|null} placementLastResolvedFace
 *
 * @property {number} placementLastAnchorCommitAtMs
 * @property {string|null} placementLastAnchorKind
 * @property {GridCell|null} placementLastAnchorCell
 * @property {string|null} placementLastAnchorFace
 * @property {boolean} placementLastAnchorAccepted
 * @property {string|null} placementLastAnchorReason
 *
 * // Bounded placement summary list for UI (e.g., minimap)
 * @property {PlacementAnchorSummary[]} placementAnchors
 *
 * // Assets: bounded summaries + memory stats
 * @property {number} assetsLastEventAtMs
 * @property {string|null} assetsLastEventType
 * @property {string|null} assetsLastEventKey
 * @property {AssetsMemory} assetsMemory
 * @property {Record<string, AssetSummary>} assetsByKey
 * @property {AssetErrorItem[]} assetsRecentErrors
 * @property {AssetEvictionItem[]} assetsRecentEvictions
 * @property {number} assetsWarnings
 */

const MAX_ASSETS_BY_KEY = 250;
const MAX_ASSET_ERRORS = 25;
const MAX_ASSET_EVICTIONS = 25;

const HEALTH = /** @type {const} */ ({
  UNKNOWN: 'UNKNOWN',
  OK: 'OK',
  LOW_FPS: 'LOW_FPS',
  HIGH_JITTER: 'HIGH_JITTER',
  STALE: 'STALE',
});

/** @returns {Observability} */
export function createDefaultObservability() {
  return {
    lastTelemetryAtMs: 0,
    telemetry: null,
    stableStats: null,

    stableSeq: 0,
    basedOnTelemetryAtMs: null,
    lastStableSentAtMs: 0,
    stableComputeLagMs: null,

    health: HEALTH.UNKNOWN,
    supportedTelemetryFields: [],

    // Existing fields
    lastStableAtMs: 0,
    telemetryStale: false,
    stableStale: false,

    // Bus summaries
    busLastAtMs: 0,
    busLastId: null,
    busLastChannel: null,
    busLastType: null,
    busLastSeq: 0,
    mathLastAtMs: 0,
    mathLastSeq: 0,
    placementLastAtMs: 0,
    placementLastSeq: 0,
    physicsLastAtMs: 0,
    physicsLastSeq: 0,
    uiLastAtMs: 0,
    uiLastSeq: 0,
    assetLastAtMs: 0,
    assetLastSeq: 0,

    uiTelemetryEnabled: true,
    uiMinimapZoom: 1,
    uiLastPingAtMs: 0,
    uiLastInventorySortAtMs: 0,

    mathLastFieldSampleAtMs: 0,
    mathLastHeight: null,
    mathLastNormal: null,
    mathLastEnergy: null,

    mathLastOrientationAtMs: 0,
    mathLastFace: null,
    mathLastSpinRad: null,
    mathLastQuaternion: null,

    placementLastGridSnapAtMs: 0,
    placementLastCell: null,
    placementLastCubeSize: null,

    placementLastFaceResolveAtMs: 0,
    placementLastResolvedFace: null,

    placementLastAnchorCommitAtMs: 0,
    placementLastAnchorKind: null,
    placementLastAnchorCell: null,
    placementLastAnchorFace: null,
    placementLastAnchorAccepted: false,
    placementLastAnchorReason: null,

    placementAnchors: [],

    assetsLastEventAtMs: 0,
    assetsLastEventType: null,
    assetsLastEventKey: null,
    assetsMemory: {
      memoryLimitMB: 0,
      totalMB: 0,
      percentUsed: 0,
      inFlight: 0,
      queued: 0,
      counts: {},
      lastUpdateMs: 0,
    },
    assetsByKey: {},
    assetsRecentErrors: [],
    assetsRecentEvictions: [],
    assetsWarnings: 0,
  };
}

/** @param {any} v */
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** @param {any} v */
function isNullableFiniteNumber(v) {
  return v === null || isFiniteNumber(v);
}

/** @param {any} v */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** @param {any} v */
function hasValidPlacementAnchors(v) {
  return (
    Array.isArray(v.placementAnchors) &&
    v.placementAnchors.every((x) => isPlacementAnchorSummary(x))
  );
}

/** @param {any} v */
function hasValidUiFields(v) {
  return (
    isFiniteNumber(v.uiLastAtMs) &&
    isFiniteNumber(v.uiLastSeq) &&
    typeof v.uiTelemetryEnabled === 'boolean' &&
    isNullableFiniteNumber(v.uiMinimapZoom) &&
    isFiniteNumber(v.uiLastPingAtMs) &&
    isFiniteNumber(v.uiLastInventorySortAtMs)
  );
}

/** @param {any} counts */
function isCountsMap(counts) {
  if (!isPlainObject(counts)) return false;
  for (const k of Object.keys(counts)) {
    if (!isFiniteNumber(counts[k])) return false;
  }
  return true;
}

/** @param {any} v @returns {v is AssetStatus} */
function isAssetStatus(v) {
  return (
    v === 'idle' ||
    v === 'queued' ||
    v === 'loading' ||
    v === 'loaded' ||
    v === 'error' ||
    v === 'evicted'
  );
}

/** @param {any} v @returns {v is AssetSummary} */
function isAssetSummary(v) {
  return (
    isPlainObject(v) &&
    typeof v.key === 'string' &&
    typeof v.assetType === 'string' &&
    typeof v.id === 'string' &&
    (v.path === null || typeof v.path === 'string') &&
    isAssetStatus(v.status) &&
    isFiniteNumber(v.progress) &&
    isFiniteNumber(v.sizeMB) &&
    (v.error === null || typeof v.error === 'string') &&
    typeof v.fromCache === 'boolean' &&
    isFiniteNumber(v.lastUpdateMs)
  );
}

/** @param {any} v @returns {v is AssetsMemory} */
function isAssetsMemory(v) {
  return (
    isPlainObject(v) &&
    isFiniteNumber(v.memoryLimitMB) &&
    isFiniteNumber(v.totalMB) &&
    isFiniteNumber(v.percentUsed) &&
    isFiniteNumber(v.inFlight) &&
    isFiniteNumber(v.queued) &&
    isCountsMap(v.counts) &&
    isFiniteNumber(v.lastUpdateMs)
  );
}

/** @param {any} v @returns {v is AssetErrorItem} */
function isAssetErrorItem(v) {
  return (
    isPlainObject(v) &&
    isFiniteNumber(v.atMs) &&
    typeof v.key === 'string' &&
    typeof v.assetType === 'string' &&
    typeof v.id === 'string' &&
    (v.path === null || typeof v.path === 'string') &&
    typeof v.error === 'string'
  );
}

/** @param {any} v @returns {v is AssetEvictionItem} */
function isAssetEvictionItem(v) {
  return (
    isPlainObject(v) &&
    isFiniteNumber(v.atMs) &&
    typeof v.key === 'string' &&
    typeof v.assetType === 'string' &&
    typeof v.id === 'string' &&
    isFiniteNumber(v.sizeMB) &&
    isFiniteNumber(v.memoryMBTotal)
  );
}

/** @param {any} v */
function hasValidAssetsFields(v) {
  const assetsByKey = v.assetsByKey;
  if (!isPlainObject(assetsByKey)) return false;
  for (const k of Object.keys(assetsByKey)) {
    if (!isAssetSummary(assetsByKey[k])) return false;
  }

  return (
    isFiniteNumber(v.assetsLastEventAtMs) &&
    (v.assetsLastEventType === null || typeof v.assetsLastEventType === 'string') &&
    (v.assetsLastEventKey === null || typeof v.assetsLastEventKey === 'string') &&
    isAssetsMemory(v.assetsMemory) &&
    Array.isArray(v.assetsRecentErrors) &&
    v.assetsRecentErrors.every((x) => isAssetErrorItem(x)) &&
    Array.isArray(v.assetsRecentEvictions) &&
    v.assetsRecentEvictions.every((x) => isAssetEvictionItem(x)) &&
    isFiniteNumber(v.assetsWarnings)
  );
}

/** @param {any} v @returns {v is Health} */
export function isHealth(v) {
  return (
    v === HEALTH.UNKNOWN ||
    v === HEALTH.OK ||
    v === HEALTH.LOW_FPS ||
    v === HEALTH.HIGH_JITTER ||
    v === HEALTH.STALE
  );
}

/** @param {any} v @returns {v is {x:number,y:number,z:number}} */
export function isPosition(v) {
  return isPlainObject(v) && isFiniteNumber(v.x) && isFiniteNumber(v.y) && isFiniteNumber(v.z);
}

/** @param {any} v @returns {v is GridCell} */
export function isGridCell(v) {
  return (
    isPlainObject(v) &&
    isFiniteNumber(v.i) &&
    isFiniteNumber(v.j) &&
    isFiniteNumber(v.k) &&
    Number.isInteger(v.i) &&
    Number.isInteger(v.j) &&
    Number.isInteger(v.k)
  );
}

/** @param {any} v @returns {v is [number, number]} */
function isCellIk(v) {
  return Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]);
}

/** @param {any} v @returns {v is PlacementAnchorSummary} */
function isPlacementAnchorSummary(v) {
  return (
    isPlainObject(v) &&
    typeof v.kind === 'string' &&
    isCellIk(v.cell) &&
    (v.face === undefined || v.face === null || typeof v.face === 'string')
  );
}

/** @param {any} v @returns {v is QuaternionArray} */
export function isQuaternionArray(v) {
  return Array.isArray(v) && v.length === 4 && v.every((x) => isFiniteNumber(x));
}

/** @param {any} v @returns {v is TelemetrySample} */
export function isTelemetrySample(v) {
  if (!isPlainObject(v)) return false;

  return (
    isFiniteNumber(v.measuredAtMs) &&
    isNullableFiniteNumber(v.sentAtMs) &&
    isNullableFiniteNumber(v.fps) &&
    isNullableFiniteNumber(v.dtMs) &&
    isNullableFiniteNumber(v.frameTimeMs) &&
    (v.appliedParams === null || isPlainObject(v.appliedParams)) &&
    isNullableFiniteNumber(v.lastRevisionApplied) &&
    (v.position === null || isPosition(v.position))
  );
}

/** @param {any} v @returns {v is StableStats} */
export function isStableStats(v) {
  if (!isPlainObject(v)) return false;

  return (
    isFiniteNumber(v.computedAtMs) &&
    isNullableFiniteNumber(v.stableFps) &&
    isNullableFiniteNumber(v.stableFrameTimeMs) &&
    isNullableFiniteNumber(v.jitterMs) &&
    isHealth(v.health)
  );
}

/** @param {any} v @returns {v is Observability} */
export function isObservability(v) {
  if (!isPlainObject(v)) return false;

  const checks = [
    isFiniteNumber(v.lastTelemetryAtMs),
    v.telemetry === null || isTelemetrySample(v.telemetry),
    v.stableStats === null || isStableStats(v.stableStats),
    isFiniteNumber(v.stableSeq),
    isNullableFiniteNumber(v.basedOnTelemetryAtMs),
    isFiniteNumber(v.lastStableSentAtMs),
    isNullableFiniteNumber(v.stableComputeLagMs),
    isHealth(v.health),
    Array.isArray(v.supportedTelemetryFields) &&
      v.supportedTelemetryFields.every((x) => typeof x === 'string'),
    isFiniteNumber(v.lastStableAtMs),
    typeof v.telemetryStale === 'boolean',
    typeof v.stableStale === 'boolean',

    isFiniteNumber(v.busLastAtMs),
    v.busLastId === null || typeof v.busLastId === 'string',
    v.busLastChannel === null || typeof v.busLastChannel === 'string',
    v.busLastType === null || typeof v.busLastType === 'string',
    isFiniteNumber(v.busLastSeq),
    isFiniteNumber(v.mathLastAtMs),
    isFiniteNumber(v.mathLastSeq),
    isFiniteNumber(v.placementLastAtMs),
    isFiniteNumber(v.placementLastSeq),
    isFiniteNumber(v.physicsLastAtMs),
    isFiniteNumber(v.physicsLastSeq),
    isFiniteNumber(v.assetLastAtMs),
    isFiniteNumber(v.assetLastSeq),

    isFiniteNumber(v.mathLastFieldSampleAtMs),
    isNullableFiniteNumber(v.mathLastHeight),
    v.mathLastNormal === null || isPosition(v.mathLastNormal),
    isNullableFiniteNumber(v.mathLastEnergy),

    isFiniteNumber(v.mathLastOrientationAtMs),
    v.mathLastFace === null || typeof v.mathLastFace === 'string',
    isNullableFiniteNumber(v.mathLastSpinRad),
    v.mathLastQuaternion === null || isQuaternionArray(v.mathLastQuaternion),

    isFiniteNumber(v.placementLastGridSnapAtMs),
    v.placementLastCell === null || isGridCell(v.placementLastCell),
    isNullableFiniteNumber(v.placementLastCubeSize),

    isFiniteNumber(v.placementLastFaceResolveAtMs),
    v.placementLastResolvedFace === null || typeof v.placementLastResolvedFace === 'string',

    isFiniteNumber(v.placementLastAnchorCommitAtMs),
    v.placementLastAnchorKind === null || typeof v.placementLastAnchorKind === 'string',
    v.placementLastAnchorCell === null || isGridCell(v.placementLastAnchorCell),
    v.placementLastAnchorFace === null || typeof v.placementLastAnchorFace === 'string',
    typeof v.placementLastAnchorAccepted === 'boolean',
    v.placementLastAnchorReason === null || typeof v.placementLastAnchorReason === 'string',
  ];

  return (
    checks.every(Boolean) &&
    hasValidUiFields(v) &&
    hasValidPlacementAnchors(v) &&
    hasValidAssetsFields(v)
  );
}

/**
 * @param {any} patch
 * @param {string} key
 */
function readKey(patch, key) {
  return patch && typeof patch === 'object' ? patch[key] : undefined;
}

/**
 * @param {any} patch
 * @param {string[]} keys
 * @param {(key: string, value: any) => void} apply
 */
function forKeys(patch, keys, apply) {
  for (const key of keys) apply(key, readKey(patch, key));
}

/** @param {any} v */
function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * @param {any} patch
 * @param {any} next
 * @param {string[]} keys
 */
function applyFiniteNumbers(patch, next, keys) {
  forKeys(patch, keys, (key, value) => {
    if (isFiniteNumber(value)) next[key] = value;
  });
}

/**
 * @param {any} patch
 * @param {any} next
 * @param {string[]} keys
 */
function applyNullableFiniteNumbers(patch, next, keys) {
  forKeys(patch, keys, (key, value) => {
    if (value === null) next[key] = null;
    else if (isFiniteNumber(value)) next[key] = value;
  });
}

/**
 * @param {any} patch
 * @param {any} next
 * @param {string} key
 * @param {(v:any)=>boolean} validator
 */
function applyNullableValidated(patch, next, key, validator) {
  const value = readKey(patch, key);
  if (value === null) next[key] = null;
  else if (value !== undefined && validator(value)) next[key] = value;
}

/**
 * @param {any} patch
 * @param {any} next
 * @param {string} key
 */
function applyStringArrayField(patch, next, key) {
  const value = readKey(patch, key);
  if (isStringArray(value)) next[key] = value.slice(0);
}

/**
 * @param {any} patch
 * @param {any} next
 * @param {string} key
 */
function applyPlacementAnchorsField(patch, next, key) {
  const value = readKey(patch, key);
  if (!Array.isArray(value)) return;

  const out = [];
  for (const item of value) {
    if (!isPlacementAnchorSummary(item)) continue;
    out.push({ kind: item.kind, cell: [item.cell[0], item.cell[1]], face: item.face ?? null });
  }

  next[key] = out;
}

/**
 * @param {any} patch
 * @param {any} next
 * @param {string[]} keys
 */
function applyBooleans(patch, next, keys) {
  forKeys(patch, keys, (key, value) => {
    if (typeof value === 'boolean') next[key] = value;
  });
}

/**
 * @param {any} patch
 * @param {any} next
 * @param {string[]} keys
 */
function applyNullableStrings(patch, next, keys) {
  forKeys(patch, keys, (key, value) => {
    if (value === null) next[key] = null;
    else if (typeof value === 'string') next[key] = value;
  });
}

function pruneAssetsByKey(mapObj, limit) {
  const m = isPlainObject(mapObj) ? mapObj : {};
  const keys = Object.keys(m);
  if (keys.length <= limit) return { ...m };

  keys.sort((a, b) => {
    const A = m[a] && typeof m[a].lastUpdateMs === 'number' ? m[a].lastUpdateMs : 0;
    const B = m[b] && typeof m[b].lastUpdateMs === 'number' ? m[b].lastUpdateMs : 0;
    return B - A;
  });

  const out = {};
  for (let i = 0; i < Math.min(limit, keys.length); i += 1) {
    const k = keys[i];
    out[k] = m[k];
  }
  return out;
}

function applyAssetsMemoryField(patch, next, key) {
  const value = readKey(patch, key);
  if (value !== undefined && isAssetsMemory(value))
    next[key] = { ...value, counts: { ...value.counts } };
}

function applyAssetsByKeyField(patch, next, key) {
  const value = readKey(patch, key);
  if (!isPlainObject(value)) return;

  const validated = {};
  for (const k of Object.keys(value)) {
    const item = value[k];
    if (!isAssetSummary(item)) continue;
    validated[k] = {
      key: item.key,
      assetType: item.assetType,
      id: item.id,
      path: item.path ?? null,
      status: item.status,
      progress: item.progress,
      sizeMB: item.sizeMB,
      error: item.error ?? null,
      fromCache: item.fromCache,
      lastUpdateMs: item.lastUpdateMs,
    };
  }

  next[key] = pruneAssetsByKey(validated, MAX_ASSETS_BY_KEY);
}

function applyAssetItemsField(patch, next, key, validator, limit) {
  const value = readKey(patch, key);
  if (!Array.isArray(value)) return;

  const out = [];
  for (const item of value) {
    if (!validator(item)) continue;
    out.push(item);
    if (out.length >= limit) break;
  }
  next[key] = out;
}

/**
 * Safe merge:
 * - Keeps defaults for missing fields
 * - Ignores unknown keys (future proof + prevents clobber)
 * - Validates nested shapes when provided
 *
 * @param {Observability} base
 * @param {Partial<Observability>} patch
 * @returns {Observability}
 */
export function mergeObservability(base, patch) {
  const next = { ...base };

  applyFiniteNumbers(patch, next, [
    'lastTelemetryAtMs',
    'stableSeq',
    'lastStableSentAtMs',
    'lastStableAtMs',
    'busLastAtMs',
    'busLastSeq',
    'mathLastAtMs',
    'mathLastSeq',
    'placementLastAtMs',
    'placementLastSeq',
    'physicsLastAtMs',
    'physicsLastSeq',
    'uiLastAtMs',
    'uiLastSeq',
    'mathLastFieldSampleAtMs',
    'mathLastOrientationAtMs',
    'placementLastGridSnapAtMs',
    'placementLastFaceResolveAtMs',
    'placementLastAnchorCommitAtMs',
    'uiLastPingAtMs',
    'uiLastInventorySortAtMs',
    'assetLastAtMs',
    'assetLastSeq',
    'assetsLastEventAtMs',
    'assetsWarnings',
  ]);

  applyNullableFiniteNumbers(patch, next, [
    'basedOnTelemetryAtMs',
    'stableComputeLagMs',
    'mathLastHeight',
    'mathLastEnergy',
    'mathLastSpinRad',
    'placementLastCubeSize',
    'uiMinimapZoom',
  ]);

  applyNullableValidated(patch, next, 'telemetry', isTelemetrySample);
  applyNullableValidated(patch, next, 'stableStats', isStableStats);

  applyNullableValidated(patch, next, 'mathLastNormal', isPosition);
  applyNullableValidated(patch, next, 'mathLastQuaternion', isQuaternionArray);
  applyNullableValidated(patch, next, 'placementLastCell', isGridCell);
  applyNullableValidated(patch, next, 'placementLastAnchorCell', isGridCell);

  applyStringArrayField(patch, next, 'supportedTelemetryFields');
  applyBooleans(patch, next, ['telemetryStale', 'stableStale', 'uiTelemetryEnabled']);

  applyNullableStrings(patch, next, [
    'busLastId',
    'busLastChannel',
    'busLastType',
    'mathLastFace',
    'placementLastResolvedFace',
    'placementLastAnchorKind',
    'placementLastAnchorFace',
    'placementLastAnchorReason',
    'assetsLastEventType',
    'assetsLastEventKey',
  ]);

  applyPlacementAnchorsField(patch, next, 'placementAnchors');

  applyAssetsMemoryField(patch, next, 'assetsMemory');
  applyAssetsByKeyField(patch, next, 'assetsByKey');
  applyAssetItemsField(patch, next, 'assetsRecentErrors', isAssetErrorItem, MAX_ASSET_ERRORS);
  applyAssetItemsField(
    patch,
    next,
    'assetsRecentEvictions',
    isAssetEvictionItem,
    MAX_ASSET_EVICTIONS,
  );

  const placementLastAnchorAccepted = readKey(patch, 'placementLastAnchorAccepted');
  if (typeof placementLastAnchorAccepted === 'boolean')
    next.placementLastAnchorAccepted = placementLastAnchorAccepted;

  const health = readKey(patch, 'health');
  if (health !== undefined && isHealth(health)) next.health = health;

  return next;
}

/**
 * Normalize unknown input into a safe Observability object.
 * Useful when hydrating from storage or external sources.
 *
 * @param {any} input
 * @returns {Observability}
 */
export function normalizeObservability(input) {
  const d = createDefaultObservability();
  if (!isPlainObject(input)) return d;
  return mergeObservability(d, /** @type {any} */ (input));
}

/**
 * Convenience: create a telemetry sample from raw message data safely.
 * @param {any} data
 * @returns {TelemetrySample|null}
 */
export function toTelemetrySample(data) {
  if (!isPlainObject(data)) return null;

  const measuredAtMs = Date.now();

  return {
    measuredAtMs,
    sentAtMs: isFiniteNumber(data.sentAtMs) ? data.sentAtMs : null,
    fps: isFiniteNumber(data.fps) ? data.fps : null,
    dtMs: isFiniteNumber(data.dtMs) ? data.dtMs : null,
    frameTimeMs: isFiniteNumber(data.frameTimeMs) ? data.frameTimeMs : null,
    appliedParams: isPlainObject(data.appliedParams) ? data.appliedParams : null,
    lastRevisionApplied: isFiniteNumber(data.lastRevisionApplied) ? data.lastRevisionApplied : null,
    position: isPosition(data.position) ? data.position : null,
  };
}
