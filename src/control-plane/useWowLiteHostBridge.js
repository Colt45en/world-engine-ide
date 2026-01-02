import { useEffect, useRef } from 'react';
import { getBus } from '../bus/bus';
import { useMathRouter } from '../math-router/MathRouter';
import { toTelemetrySample } from './observabilityContract';
import { WowLitePostMessageAdapter } from '../world-engine/adapters/WowLitePostMessageAdapter';
import { WorldEngineGateway } from '../world-engine/gateway/WorldEngineGateway';

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

    if (isDtSpike(sample)) {
      lastTelemetryAtMs = nowMs;
      return null;
    }

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

  return { ingest };
}

/**
 * Minimal host bridge for the WoW-Lite iframe.
 * - Updates MathRouter delivery/observability from READY/TELEMETRY/APPLIED.
 * - Forwards UI telemetry enable intents into WOW_LITE/CONFIG.
 */
export function useWowLiteHostBridge(iframeRef, { enabled = true } = {}) {
  const bus = getBus();
  const { updateDelivery, updateObservability } = useMathRouter();

  const hostInstanceIdRef = useRef(makeId());
  const gatewayRef = useRef(null);
  const calibratorRef = useRef(createCalibrator());
  const latestStableRef = useRef(null);
  const lastUiCommitAtMsRef = useRef(0);

  const transportRef = useRef({
    ready: false,
    telemetryEnabled: true,
    telemetryHz: 20,
    desiredRateHz: 10,
    uiCommitHz: 6,
  });

  function handleReady(msg) {
    if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;
    transportRef.current.ready = true;

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
  }

  function handleApplied(msg) {
    if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;
    updateDelivery({
      phase: 'applied',
      connection: 'connected',
      lastAppliedAtMs: typeof msg.appliedAtMs === 'number' ? msg.appliedAtMs : Date.now(),
      lastRevisionApplied: msg.revision,
      lastAppliedParams: msg.appliedParams || null,
      lastError: null,
    });
  }

  function handleTelemetry(msg) {
    if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;

    const telemetrySample = toTelemetrySample(msg.data);
    if (!telemetrySample) return;

    const stable = calibratorRef.current.ingest(telemetrySample);
    if (stable) {
      latestStableRef.current = {
        computedAtMs: Date.now(),
        stableFps: stable.stableFps ?? null,
        stableFrameTimeMs: stable.stableFrameTimeMs ?? null,
        jitterMs: stable.jitterMs ?? null,
        health: stable.health || 'UNKNOWN',
      };
    }

    const now = Date.now();
    const uiHz = transportRef.current.uiCommitHz || 6;
    const minUiIntervalMs = Math.max(1, Math.floor(1000 / Math.max(1, uiHz)));
    if (now - lastUiCommitAtMsRef.current < minUiIntervalMs) return;
    lastUiCommitAtMsRef.current = now;

    updateObservability({
      lastTelemetryAtMs: telemetrySample.measuredAtMs,
      telemetry: telemetrySample,
      stableStats: latestStableRef.current,
      health:
        latestStableRef.current && latestStableRef.current.health
          ? latestStableRef.current.health
          : 'UNKNOWN',
      telemetryStale: false,
      stableStale: false,
    });
  }

  function handleStatus(msg) {
    if (msg.hostInstanceId && msg.hostInstanceId !== hostInstanceIdRef.current) return;
    updateDelivery({
      connection: 'connected',
      lastHeartbeatAtMs: typeof msg.now === 'number' ? msg.now : Date.now(),
      lastRevisionApplied:
        typeof msg.lastRevisionApplied === 'number' ? msg.lastRevisionApplied : null,
      lastAppliedParams: msg.currentParams || null,
    });
  }

  useEffect(() => {
    if (!enabled) return;

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
    gateway.start();
    gatewayRef.current = gateway;

    const unsubscribe = gateway.subscribe((evt) => {
      if (!evt || evt.type !== 'GATEWAY/MSG') return;
      if (evt.source !== 'transport.pm.wowLite') return;
      const msg = evt.msg;
      if (!msg || typeof msg !== 'object') return;

      const handlers = {
        'WOW_LITE/READY': () => handleReady(msg),
        'WOW_LITE/APPLIED': () => handleApplied(msg),
        'WOW_LITE/TELEMETRY': () => handleTelemetry(msg),
        'WOW_LITE/STATUS': () => handleStatus(msg),
      };

      const handler = handlers[msg.type];
      if (handler) handler();
    });

    return () => {
      unsubscribe();
      gateway.stop();
      if (gatewayRef.current === gateway) gatewayRef.current = null;
    };
  }, [enabled, iframeRef, updateDelivery, updateObservability]);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = bus.subscribe('UI', (e) => {
      if (e.type !== 'SET_TELEMETRY_ENABLED') return;
      const enabledNext = Boolean(e.payload && e.payload.enabled);

      transportRef.current.telemetryEnabled = enabledNext;

      const gateway = gatewayRef.current;
      if (!gateway || !transportRef.current.ready) return;
      gateway.setWowLiteTelemetryEnabled(enabledNext);
    });

    return () => unsubscribe();
  }, [enabled, iframeRef, bus]);
}
