import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getBus } from '../bus/bus';
import WowLite from '../components/Studio/WowLite.jsx';
import { toTelemetrySample } from '../control-plane/observabilityContract';
import { WOW_LITE_SCHEMA_VERSION } from '../control-plane/wowLiteProtocol';
import { useMathRouter } from '../math-router/MathRouter';
import { HudRoot } from '../ui/HudRoot';
import { ToolWindowPostMessageAdapter } from '../world-engine/adapters/ToolWindowPostMessageAdapter';
import { WowLitePostMessageAdapter } from '../world-engine/adapters/WowLitePostMessageAdapter';
import { WorldEngineGateway } from '../world-engine/gateway/WorldEngineGateway';

function clamp(n, min, max) {
  if (typeof n !== 'number' || Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function nearlyEqual(a, b, eps) {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) <= eps;
}

function paramsNearlyEqual(a, b, eps = 0.01) {
  const keys = ['moveSpeed', 'gravity', 'jumpSpeed', 'manaRegen'];
  for (const key of keys) {
    const av = a && typeof a[key] === 'number' ? a[key] : undefined;
    const bv = b && typeof b[key] === 'number' ? b[key] : undefined;
    if (av === undefined && bv === undefined) continue;
    if (av === undefined || bv === undefined) return false;
    if (Math.abs(av - bv) > eps) return false;
  }
  return true;
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getIframeWindow(iframeRef) {
  const iframe = iframeRef && iframeRef.current;
  return iframe && iframe.contentWindow ? iframe.contentWindow : null;
}

function isValidPayload(p) {
  if (!p) return false;
  if (p.schemaVersion !== 1) return false;
  if (typeof p.expression !== 'string') return false;
  if (typeof p.result !== 'number' || !Number.isFinite(p.result)) return false;
  if (!p.variables || typeof p.variables !== 'object') return false;
  return true;
}

function parseFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function isDtSpike(sample) {
  const dtMs = parseFiniteNumber(sample && sample.dtMs);
  return dtMs != null && dtMs > 250;
}

function computeHealth(stableFps, jitterMs) {
  if (stableFps < 20) return 'LOW_FPS';
  if (jitterMs > 12) return 'HIGH_JITTER';
  return 'OK';
}

function createCalibrator() {
  const alpha = 0.15;
  let emaFps = null;
  let emaFrameMs = null;
  let emaJitterMs = 0;
  let lastTelemetryAtMs = 0;

  function reset(nowMs = Date.now()) {
    emaFps = null;
    emaFrameMs = null;
    emaJitterMs = 0;
    lastTelemetryAtMs = nowMs;
  }

  function ingest(sample) {
    if (!sample || typeof sample !== 'object') return null;
    const fps = parseFiniteNumber(sample.fps);
    const frameTimeMs = parseFiniteNumber(sample.frameTimeMs);
    if (fps == null || frameTimeMs == null) return null;

    const nowMs = Date.now();

    // Ignore tab-sleep / huge dt spikes. (Still counts as “telemetry seen”.)
    if (isDtSpike(sample)) {
      lastTelemetryAtMs = nowMs;
      return null;
    }

    // If we had a long gap, reset EMA so we don't storm HIGH_JITTER.
    if (lastTelemetryAtMs && nowMs - lastTelemetryAtMs > 4000) {
      reset(nowMs);
    }

    emaFps = emaFps == null ? fps : emaFps + alpha * (fps - emaFps);
    emaFrameMs = emaFrameMs == null ? frameTimeMs : emaFrameMs + alpha * (frameTimeMs - emaFrameMs);

    const jitterNow = emaFrameMs == null ? 0 : Math.abs(frameTimeMs - emaFrameMs);
    emaJitterMs = emaJitterMs + alpha * (jitterNow - emaJitterMs);

    lastTelemetryAtMs = nowMs;

    const health = computeHealth(emaFps, emaJitterMs);

    return {
      stableFps: emaFps,
      stableFrameTimeMs: emaFrameMs,
      jitterMs: emaJitterMs,
      health,
      lastTelemetryAtMs,
    };
  }

  function isStale(nowMs, maxAgeMs = 3000) {
    if (!lastTelemetryAtMs) return true;
    return nowMs - lastTelemetryAtMs > maxAgeMs;
  }

  return { ingest, isStale, reset };
}

export function GamePage() {
  const history = useHistory();
  const { payload, payloadId, clear, updateDelivery, updateObservability } = useMathRouter();

  const iframeRef = useRef(null);
  const hostInstanceIdRef = useRef(makeId());
  const gatewayRef = useRef(null);
  const wowAdapterRef = useRef(null);
  const toolAdapterRef = useRef(null);

  const [toolWindowOpen, setToolWindowOpen] = useState(false);
  const calibratorRef = useRef(createCalibrator());
  const latestTelemetryRef = useRef(null);
  const latestStableRef = useRef(null);
  const stableSeqRef = useRef(0);
  const lastUiCommitAtMsRef = useRef(0);
  const transportRef = useRef({
    ready: false,
    tunerVersion: null,
    supportedParams: null,
    ranges: null,
    rateLimits: null,
    lastHeartbeatAtMs: 0,
    lastTelemetryAtMs: 0,
    lastStableStatsSentAtMs: 0,
    lastStableAtMs: 0,
    revision: 0,
    inflight: null,
    pendingParams: null,
    lastTargetParams: null,
    lastSentParams: null,
    lastSendAtMs: 0,
    desiredRateHz: 10,
    telemetryHz: 20,
    telemetryEnabled: true,
    stableStatsHz: 2,
    uiCommitHz: 6,
    ackTimeoutId: null,
  });

  const [bootedWith, setBootedWith] = useState(null);
  const [editorEnabled, setEditorEnabled] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [ghost, setGhost] = useState(null);
  const viewportRef = useRef(null);
  const entitiesRef = useRef(new Map());
  const [entityCount, setEntityCount] = useState(0);

  const fileInputRef = useRef(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [textureStatus, setTextureStatus] = useState('(default)');
  const [toolParams, setToolParams] = useState({
    moveSpeed: 6,
    gravity: -20,
    jumpSpeed: 8,
    manaRegen: 3,
  });

  const enqueueTunerParams = (nextParams) => {
    const ranges = transportRef.current.ranges;
    const clampWithRange = (key, fallbackMin, fallbackMax, v) => {
      const r = ranges && ranges[key] && typeof ranges[key] === 'object' ? ranges[key] : null;
      const min = r && typeof r.min === 'number' ? r.min : fallbackMin;
      const max = r && typeof r.max === 'number' ? r.max : fallbackMax;
      return clamp(v, min, max);
    };

    const params = {
      moveSpeed: clampWithRange('moveSpeed', 1, 12, nextParams.moveSpeed),
      gravity: clampWithRange('gravity', -40, -5, nextParams.gravity),
      jumpSpeed: clampWithRange('jumpSpeed', 2, 16, nextParams.jumpSpeed),
      manaRegen: clampWithRange('manaRegen', 0, 10, nextParams.manaRegen),
    };

    transportRef.current.pendingParams = params;
    transportRef.current.lastTargetParams = params;
    updateDelivery({ phase: 'queued', targetParams: params, lastError: null });
  };

  const status = useMemo(() => {
    if (!payload || !payloadId) return { ok: false, reason: 'No math payload routed in.' };
    if (!isValidPayload(payload)) return { ok: false, reason: 'Invalid payload schema.' };
    return { ok: true };
  }, [payload, payloadId]);

  useEffect(() => {
    if (!status.ok) return;
    setBootedWith(payload);
  }, [status.ok, payload]);

  useEffect(() => {
    const gateway = new WorldEngineGateway({
      wowLite: {
        hostInstanceId: hostInstanceIdRef.current,
        desiredRateHz: transportRef.current.desiredRateHz,
        telemetryEnabled: transportRef.current.telemetryEnabled,
        telemetryHz: transportRef.current.telemetryHz,
      },
    });
    const wowAdapter = new WowLitePostMessageAdapter({ iframeRef });
    gateway.attachWowLite(wowAdapter);

    const toolUrl =
      import.meta.env?.VITE_NEXUS_TOOL_URL || `${globalThis.location.origin}/tools/nexus-tool.html`;
    const toolOrigin = import.meta.env?.VITE_NEXUS_TOOL_ORIGIN || globalThis.location.origin;
    const toolAdapter = new ToolWindowPostMessageAdapter({
      toolUrl,
      toolOrigin,
      logger: console,
    });
    gateway.attachToolWindow(toolAdapter);

    gateway.start();

    gatewayRef.current = gateway;
    wowAdapterRef.current = wowAdapter;
    toolAdapterRef.current = toolAdapter;

    const handleReady = (msg) => {
      transportRef.current.ready = true;
      transportRef.current.tunerVersion = msg.tunerVersion || null;
      transportRef.current.supportedParams = Array.isArray(msg.supportedParams)
        ? msg.supportedParams
        : null;
      transportRef.current.ranges =
        msg.ranges && typeof msg.ranges === 'object' ? msg.ranges : null;
      transportRef.current.rateLimits =
        msg.rateLimits && typeof msg.rateLimits === 'object' ? msg.rateLimits : null;
      transportRef.current.lastHeartbeatAtMs = Date.now();

      updateDelivery({
        phase: 'ready',
        ready: true,
        connection: 'connected',
        capabilities: {
          tunerVersion: msg.tunerVersion || null,
          supportedParams: Array.isArray(msg.supportedParams) ? msg.supportedParams : null,
          ranges: msg.ranges && typeof msg.ranges === 'object' ? msg.ranges : null,
          rateLimits: msg.rateLimits && typeof msg.rateLimits === 'object' ? msg.rateLimits : null,
        },
        lastError: null,
      });

      updateObservability({
        telemetryStale: false,
        stableStale: false,
        health: 'UNKNOWN',
        supportedTelemetryFields: Array.isArray(msg.supportedTelemetryFields)
          ? msg.supportedTelemetryFields
          : [],
      });
    };

    const handleApplied = (msg) => {
      const inflight = transportRef.current.inflight;
      if (!inflight || inflight.revision !== msg.revision) return;
      if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;

      if (transportRef.current.ackTimeoutId) {
        clearTimeout(transportRef.current.ackTimeoutId);
        transportRef.current.ackTimeoutId = null;
      }

      transportRef.current.inflight = null;

      const now = Date.now();
      const latencyMs = typeof inflight.sentAtMs === 'number' ? now - inflight.sentAtMs : null;

      const appliedParams = msg.appliedParams || null;
      const targetParams = inflight.targetParams || null;
      let clampDelta = null;
      if (appliedParams && targetParams) {
        clampDelta = {};
        for (const [k, v] of Object.entries(targetParams)) {
          if (typeof v === 'number' && typeof appliedParams[k] === 'number') {
            clampDelta[k] = v - appliedParams[k];
          }
        }
      }

      updateDelivery({
        phase: 'applied',
        connection: 'connected',
        lastAppliedAtMs: now,
        lastRevisionApplied: msg.revision,
        lastAppliedParams: appliedParams,
        targetParams,
        clampDelta,
        lastError: null,
        latencyMs,
      });

      if (appliedParams && typeof appliedParams === 'object') {
        setToolParams((prev) => ({
          ...prev,
          ...appliedParams,
        }));
      }
    };

    const handleRejected = (msg) => {
      if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;
      if (transportRef.current.ackTimeoutId) {
        clearTimeout(transportRef.current.ackTimeoutId);
        transportRef.current.ackTimeoutId = null;
      }
      transportRef.current.inflight = null;

      // If the game says the revision is stale, it may still include its current applied state.
      const appliedParams = msg.currentParams || null;
      const lastRevisionApplied =
        typeof msg.lastRevisionApplied === 'number' ? msg.lastRevisionApplied : null;
      updateDelivery({
        phase: 'rejected',
        connection: 'connected',
        lastError: msg.reason || 'Rejected',
        lastAppliedParams: appliedParams,
        lastRevisionApplied,
      });
    };

    const handleStatus = (msg) => {
      if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;
      transportRef.current.lastHeartbeatAtMs = Date.now();

      updateDelivery({
        connection: 'connected',
        ready: Boolean(transportRef.current.ready),
      });

      if (typeof msg.lastRevisionApplied === 'number') {
        updateDelivery({
          lastRevisionApplied: msg.lastRevisionApplied,
          lastAppliedParams: msg.currentParams || null,
        });
      }

      if (msg.currentParams && typeof msg.currentParams === 'object') {
        setToolParams((prev) => ({
          ...prev,
          ...msg.currentParams,
        }));
      }
    };

    const handleTextureApplied = (msg) => {
      if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;
      if (typeof msg.name === 'string' && msg.name) setTextureStatus(msg.name);
    };

    const handleTextureRejected = (msg) => {
      if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;
      const name = typeof msg.name === 'string' && msg.name ? msg.name : 'texture';
      const reason = typeof msg.reason === 'string' && msg.reason ? msg.reason : 'rejected';
      setTextureStatus(`${name} (${reason})`);
    };

    const handleTelemetry = (msg) => {
      if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;

      const now = Date.now();
      transportRef.current.lastHeartbeatAtMs = now;
      const telemetrySample = toTelemetrySample(msg.data);
      if (!telemetrySample) return;

      transportRef.current.lastTelemetryAtMs = telemetrySample.measuredAtMs;

      latestTelemetryRef.current = telemetrySample;

      const stable = calibratorRef.current.ingest(telemetrySample);
      if (stable) {
        transportRef.current.lastStableAtMs = now;
        latestStableRef.current = {
          computedAtMs: now,
          stableFps: stable.stableFps ?? null,
          stableFrameTimeMs: stable.stableFrameTimeMs ?? null,
          jitterMs: stable.jitterMs ?? null,
          health: stable.health || 'UNKNOWN',
        };
      }

      // Throttle UI commits so telemetry can't become the perf problem.
      const uiHz = transportRef.current.uiCommitHz || 6;
      const minUiIntervalMs = Math.max(1, Math.floor(1000 / Math.max(1, uiHz)));
      if (now - lastUiCommitAtMsRef.current >= minUiIntervalMs) {
        lastUiCommitAtMsRef.current = now;
        updateObservability({
          lastTelemetryAtMs: transportRef.current.lastTelemetryAtMs,
          telemetry: latestTelemetryRef.current,
          stableStats: latestStableRef.current,
          lastStableAtMs: transportRef.current.lastStableAtMs,
          health:
            latestStableRef.current && latestStableRef.current.health
              ? latestStableRef.current.health
              : 'UNKNOWN',
          telemetryStale: false,
          stableStale: false,
        });
      }

      // Echo stable stats at low rate, include seq + freshness.
      if (!stable) return;
      const hz = transportRef.current.stableStatsHz || 2;
      const minIntervalMs = Math.max(1, Math.floor(1000 / Math.max(1, hz)));
      if (now - (transportRef.current.lastStableStatsSentAtMs || 0) < minIntervalMs) return;
      transportRef.current.lastStableStatsSentAtMs = now;

      const stableSeq = stableSeqRef.current++;
      const basedOnTelemetryAtMs = transportRef.current.lastTelemetryAtMs || null;
      gateway.sendWowLite({
        type: 'WOW_LITE/STABLE_STATS',
        schemaVersion: WOW_LITE_SCHEMA_VERSION,
        hostInstanceId: hostInstanceIdRef.current,
        stableSeq,
        basedOnTelemetryAtMs,
        data: stable,
        now,
      });

      updateObservability({
        stableSeq,
        basedOnTelemetryAtMs,
        lastStableSentAtMs: now,
        stableComputeLagMs: basedOnTelemetryAtMs ? now - basedOnTelemetryAtMs : null,
      });
    };

    const handleWowLiteMessage = (msg) => {
      const handleEntityUpsert = () => {
        if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;
        const instanceId = typeof msg.instanceId === 'string' ? msg.instanceId : null;
        if (!instanceId) return;
        entitiesRef.current.set(instanceId, msg);
        setEntityCount(entitiesRef.current.size);
      };

      const handleEntityRemove = () => {
        if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;
        const instanceId = typeof msg.instanceId === 'string' ? msg.instanceId : null;
        if (!instanceId) return;
        entitiesRef.current.delete(instanceId);
        setEntityCount(entitiesRef.current.size);
      };

      const handlers = {
        'WOW_LITE/READY': () => handleReady(msg),
        'WOW_LITE/STATUS': () => handleStatus(msg),
        'WOW_LITE/TELEMETRY': () => handleTelemetry(msg),
        'WOW_LITE/APPLIED': () => handleApplied(msg),
        'WOW_LITE/REJECTED': () => handleRejected(msg),
        'WOW_LITE/ENTITY_UPSERT': handleEntityUpsert,
        'WOW_LITE/ENTITY_REMOVE': handleEntityRemove,
        'WOW_LITE/ASSET_TEXTURE_APPLIED': () => handleTextureApplied(msg),
        'WOW_LITE/ASSET_TEXTURE_REJECTED': () => handleTextureRejected(msg),
      };

      const handler = handlers[msg.type];
      if (handler) handler();
    };

    const unsubscribe = gateway.subscribe((evt) => {
      if (!evt || evt.type !== 'GATEWAY/MSG') return;

      if (evt.source === 'transport.pm.wowLite') {
        const msg = evt.msg;
        if (!msg || typeof msg !== 'object') return;
        handleWowLiteMessage(msg);
        return;
      }

      if (evt.source === 'transport.pm.toolWindow') {
        const msg = evt.msg;
        if (!msg || typeof msg !== 'object') return;

        // Tool -> engine handshake.
        if (msg.type === 'TOOL/READY') {
          setToolWindowOpen(true);
          return;
        }

        // Back-compat: older tool sends NEXUS_HELLO; respond with ENGINE/HELLO.
        if (msg.type === 'NEXUS_HELLO') {
          gateway.sendToolWindow({
            type: 'ENGINE/HELLO',
            atMs: Date.now(),
            hostInstanceId: hostInstanceIdRef.current,
          });
          return;
        }

        // Tool -> engine events: forward into bus as a stream.
        if (msg.type === 'WORLD_EVENT') {
          const bus = getBus();
          bus.emit('TOOL', { type: 'WORLD_EVENT', payload: msg, atMs: Date.now() });
        }
      }
    });

    return () => {
      unsubscribe();
      gateway.closeToolWindow();
      gateway.stop();
      if (gatewayRef.current === gateway) gatewayRef.current = null;
      if (wowAdapterRef.current === wowAdapter) wowAdapterRef.current = null;
      if (toolAdapterRef.current === toolAdapter) toolAdapterRef.current = null;
    };
  }, [updateDelivery, updateObservability]);

  useEffect(() => {
    const bus = getBus();

    const unsubscribe = bus.subscribe('UI', (e) => {
      if (!e || typeof e !== 'object' || typeof e.type !== 'string') return;

      if (e.type === 'SET_TELEMETRY_ENABLED') {
        const enabled = Boolean(
          e.payload && typeof e.payload === 'object' ? e.payload.enabled : true,
        );
        transportRef.current.telemetryEnabled = enabled;

        const gateway = gatewayRef.current;
        if (gateway) gateway.setWowLiteTelemetryEnabled(enabled);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!status.ok) return;
    if (!payload) return;

    // Interpret diagnostic math result as a control signal for WoW-Lite.
    // Move speed range is 1..12 in WoW-Lite's tuner.
    const ranges = transportRef.current.ranges;
    const msRange = ranges && ranges.moveSpeed ? ranges.moveSpeed : null;
    const msMin = msRange && typeof msRange.min === 'number' ? msRange.min : 1;
    const msMax = msRange && typeof msRange.max === 'number' ? msRange.max : 12;

    const moveSpeed = clamp(payload.result, msMin, msMax);
    const params = { moveSpeed };

    const lastTarget = transportRef.current.lastTargetParams;
    if (lastTarget && nearlyEqual(lastTarget.moveSpeed, params.moveSpeed, 0.01)) {
      return;
    }

    transportRef.current.pendingParams = params;
    transportRef.current.lastTargetParams = params;
    updateDelivery({ phase: 'queued', targetParams: params, lastError: null });
  }, [status.ok, payload, updateDelivery]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      const last = transportRef.current.lastHeartbeatAtMs || 0;
      const age = now - last;

      if (!transportRef.current.ready) {
        updateDelivery({ connection: 'disconnected' });
        return;
      }

      if (age > 15000) updateDelivery({ connection: 'disconnected' });
      else if (age > 6000) updateDelivery({ connection: 'stale' });
      else updateDelivery({ connection: 'connected' });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [updateDelivery]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      const lastTelemetryAtMs = transportRef.current.lastTelemetryAtMs || 0;
      const lastStableAtMs = transportRef.current.lastStableAtMs || 0;

      const telemetryStale = !lastTelemetryAtMs || now - lastTelemetryAtMs > 3000;
      const stableStale = !lastStableAtMs || now - lastStableAtMs > 4000;

      if (telemetryStale || stableStale) {
        let health = 'UNKNOWN';
        if (telemetryStale || stableStale) health = 'STALE';
        updateObservability({
          telemetryStale,
          stableStale,
          health,
        });
      }

      // When stale, stop echoing STABLE_STATS until telemetry resumes.
      if (telemetryStale) transportRef.current.lastStableStatsSentAtMs = now;
    }, 500);

    return () => clearInterval(intervalId);
  }, [updateObservability]);

  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const gateway = gatewayRef.current;
      const t = transportRef.current;

      if (gateway && t.ready && t.pendingParams && !t.inflight) {
        const now = Date.now();
        const maxHz =
          t.rateLimits && typeof t.rateLimits.maxSendHz === 'number'
            ? t.rateLimits.maxSendHz
            : t.desiredRateHz || 10;
        const minIntervalMs = Math.max(1, Math.floor(1000 / (maxHz || 10)));
        if (now - t.lastSendAtMs >= minIntervalMs) {
          const revision = ++t.revision;
          const messageId = makeId();

          const paramsToSend = t.pendingParams;
          const lastSent = t.lastSentParams;
          if (lastSent && paramsToSend && paramsNearlyEqual(lastSent, paramsToSend, 0.01)) {
            t.pendingParams = null;
            rafId = globalThis.requestAnimationFrame(tick);
            return;
          }

          const msg = {
            type: 'WOW_LITE/TUNER_SET',
            schemaVersion: WOW_LITE_SCHEMA_VERSION,
            messageId,
            revision,
            sentAtMs: now,
            hostInstanceId: hostInstanceIdRef.current,
            params: paramsToSend,
          };

          t.pendingParams = null;
          t.inflight = {
            messageId,
            revision,
            sentAtMs: now,
            retryCount: 0,
            targetParams: paramsToSend,
          };
          t.lastSentParams = paramsToSend;
          t.lastSendAtMs = now;

          updateDelivery({
            phase: 'sent',
            lastSentAtMs: now,
            lastSentRevision: revision,
            lastSentParams: paramsToSend,
            lastError: null,
          });
          gateway.sendWowLite(msg);

          // Timeout if we never see APPLIED/REJECTED.
          if (t.ackTimeoutId) clearTimeout(t.ackTimeoutId);
          t.ackTimeoutId = setTimeout(() => {
            const inflight = transportRef.current.inflight;
            if (!inflight || inflight.revision !== revision) return;

            if (!transportRef.current.ready) {
              transportRef.current.inflight = null;
              updateDelivery({ phase: 'timeout', lastError: 'Timed out (not READY)' });
              return;
            }

            if ((inflight.retryCount || 0) < 1) {
              // Retry once with a new messageId but the same revision.
              const retryMessageId = makeId();
              transportRef.current.inflight = {
                ...inflight,
                messageId: retryMessageId,
                retryCount: (inflight.retryCount || 0) + 1,
                sentAtMs: Date.now(),
              };
              updateDelivery({ phase: 'retrying', lastError: null });
              gateway.sendWowLite({
                type: 'WOW_LITE/TUNER_SET',
                schemaVersion: WOW_LITE_SCHEMA_VERSION,
                messageId: retryMessageId,
                revision,
                sentAtMs: Date.now(),
                hostInstanceId: hostInstanceIdRef.current,
                params: inflight.targetParams,
              });
              return;
            }

            transportRef.current.inflight = null;
            updateDelivery({
              phase: 'degraded',
              lastError: 'Timed out waiting for APPLIED (after retry)',
            });
          }, 1500);
        }
      }

      rafId = globalThis.requestAnimationFrame(tick);
    };

    rafId = globalThis.requestAnimationFrame(tick);
    return () => globalThis.cancelAnimationFrame(rafId);
  }, [updateDelivery]);

  if (!status.ok) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Game</h1>
        <p style={{ color: 'crimson' }}>{status.reason}</p>
        <button onClick={() => history.push('/diagnostic')} style={{ padding: '10px 14px' }}>
          Back to Diagnostic
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <HudRoot />
      <h1>Game Environment</h1>

      <p>Booted with payload:</p>
      <pre style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, overflowX: 'auto' }}>
        {JSON.stringify(bootedWith, null, 2)}
      </pre>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => history.push('/diagnostic')} style={{ padding: '10px 14px' }}>
          Back to Diagnostic
        </button>
        <button onClick={() => clear()} style={{ padding: '10px 14px' }}>
          Clear Routed Math
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontWeight: 700 }}>WoW-Lite (Physics Sandbox)</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Entities: {entityCount}</div>
              <button
                onClick={() => setToolsOpen((v) => !v)}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Toggle launcher editor toolbar"
              >
                {toolsOpen ? 'Tools: ON' : 'Tools: OFF'}
              </button>
              <button
                type="button"
                onClick={() =>
                  fileInputRef.current && fileInputRef.current.click && fileInputRef.current.click()
                }
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Import ground texture (launcher → game)"
              >
                🖼️
              </button>
              <button
                type="button"
                onClick={() => {
                  const defaults = { moveSpeed: 6, gravity: -20, jumpSpeed: 8, manaRegen: 3 };
                  setToolParams(defaults);
                  enqueueTunerParams(defaults);
                }}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Reset tuner params"
              >
                ↺
              </button>
              <button
                onClick={() => setEditorEnabled((v) => !v)}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Toggle editor overlay interactions"
              >
                {editorEnabled ? 'Editor: ON' : 'Editor: OFF'}
              </button>
              <button
                onClick={() => setGridEnabled((v) => !v)}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Toggle grid overlay (visual only)"
              >
                {gridEnabled ? 'Grid: ON' : 'Grid: OFF'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const gateway = gatewayRef.current;
                  if (!gateway) return;

                  if (gateway.isToolWindowOpen()) {
                    gateway.closeToolWindow();
                    setToolWindowOpen(false);
                    return;
                  }

                  const ok = gateway.openToolWindow();
                  setToolWindowOpen(ok);
                }}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Open/close Nexus tool window (postMessage bridge)"
              >
                {toolWindowOpen ? 'Nexus Tool: ON' : 'Nexus Tool: OFF'}
              </button>
              <a href="/studio/wow-lite" style={{ fontSize: 12 }}>
                Open full view
              </a>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file =
                e.target && e.target.files && e.target.files[0] ? e.target.files[0] : null;
              if (!file) return;
              setTextureStatus(`Loading: ${file.name}`);

              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = typeof reader.result === 'string' ? reader.result : null;
                if (!dataUrl) {
                  setTextureStatus('(failed)');
                  return;
                }

                const gateway = gatewayRef.current;
                if (!gateway) {
                  setTextureStatus('(no gateway)');
                  return;
                }

                const ok = gateway.sendWowLite({
                  type: 'WOW_LITE/ASSET_TEXTURE_SET',
                  schemaVersion: WOW_LITE_SCHEMA_VERSION,
                  hostInstanceId: hostInstanceIdRef.current,
                  name: file.name,
                  dataUrl,
                });

                if (!ok) setTextureStatus('(no iframe)');
              };
              reader.onerror = () => setTextureStatus('(failed)');
              reader.readAsDataURL(file);

              // Allow selecting the same file again.
              e.target.value = '';
            }}
          />

          {toolsOpen ? (
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.85 }}>Texture: {textureStatus}</div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 64px',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.85 }}>Move Speed</div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={0.1}
                  value={toolParams.moveSpeed}
                  onChange={(e) => {
                    const next = { ...toolParams, moveSpeed: Number(e.target.value) };
                    setToolParams(next);
                    enqueueTunerParams(next);
                  }}
                />
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {Number(toolParams.moveSpeed).toFixed(2)}
                </div>

                <div style={{ fontSize: 12, opacity: 0.85 }}>Gravity</div>
                <input
                  type="range"
                  min={-40}
                  max={-5}
                  step={0.5}
                  value={toolParams.gravity}
                  onChange={(e) => {
                    const next = { ...toolParams, gravity: Number(e.target.value) };
                    setToolParams(next);
                    enqueueTunerParams(next);
                  }}
                />
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {Number(toolParams.gravity).toFixed(2)}
                </div>

                <div style={{ fontSize: 12, opacity: 0.85 }}>Jump Speed</div>
                <input
                  type="range"
                  min={2}
                  max={16}
                  step={0.1}
                  value={toolParams.jumpSpeed}
                  onChange={(e) => {
                    const next = { ...toolParams, jumpSpeed: Number(e.target.value) };
                    setToolParams(next);
                    enqueueTunerParams(next);
                  }}
                />
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {Number(toolParams.jumpSpeed).toFixed(2)}
                </div>

                <div style={{ fontSize: 12, opacity: 0.85 }}>Mana Regen</div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.1}
                  value={toolParams.manaRegen}
                  onChange={(e) => {
                    const next = { ...toolParams, manaRegen: Number(e.target.value) };
                    setToolParams(next);
                    enqueueTunerParams(next);
                  }}
                />
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {Number(toolParams.manaRegen).toFixed(2)}
                </div>
              </div>
            </div>
          ) : null}
          <div ref={viewportRef} style={{ position: 'relative' }}>
            <WowLite iframeRef={iframeRef} compact defaultUseReact={false} showHud={false} />

            {/* Holographic grid overlay (visual only) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: gridEnabled ? 0.18 : 0,
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.16) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />

            {/* Click-catcher: only active in editor mode */}
            <button
              type="button"
              aria-label="Place object"
              onClick={(e) => {
                if (!editorEnabled) return;
                if (!transportRef.current.ready) return;

                const rect =
                  viewportRef.current && viewportRef.current.getBoundingClientRect
                    ? viewportRef.current.getBoundingClientRect()
                    : null;
                if (!rect) return;

                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const gateway = gatewayRef.current;
                if (!gateway) return;

                const instanceId = makeId();

                setGhost({ x, y, label: 'Placing…', instanceId });
                globalThis.setTimeout(() => setGhost(null), 300);

                gateway.sendWowLite({
                  type: 'WOW_LITE/EDITOR_PLACE_REQUEST',
                  schemaVersion: WOW_LITE_SCHEMA_VERSION,
                  hostInstanceId: hostInstanceIdRef.current,
                  instanceId,
                  screen: { x, y, w: rect.width, h: rect.height },
                  prefabId: 'crate',
                });

                // Keep keyboard focus on the game after editor clicks.
                if (iframeRef.current && typeof iframeRef.current.focus === 'function')
                  iframeRef.current.focus();
                const iframeWin = getIframeWindow(iframeRef);
                if (iframeWin && typeof iframeWin.focus === 'function') iframeWin.focus();
              }}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: editorEnabled ? 'auto' : 'none',
                cursor: editorEnabled ? 'crosshair' : 'default',
                background: 'transparent',
                border: 'none',
                padding: 0,
              }}
            />

            {ghost ? (
              <div
                style={{
                  position: 'absolute',
                  left: ghost.x,
                  top: ghost.y,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  padding: '6px 10px',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.35)',
                  fontSize: 12,
                }}
              >
                {ghost.label}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
