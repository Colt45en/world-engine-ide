import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import { useMathRouter } from '../math-router/MathRouter';

function evaluate(expression, variables) {
  const x = typeof variables.x === 'number' ? variables.x : 0;

  if (expression === '2*(x+3)') return 2 * (x + 3);
  if (expression === 'x*x') return x * x;
  if (expression === 'x') return x;

  return x;
}

function PreviewResult({ computed }) {
  return (
    <div style={{ marginTop: 16 }}>
      <strong>Preview:</strong>
      {computed.ok ? (
        <span>result = {computed.result}</span>
      ) : (
        <span style={{ color: 'crimson' }}>{computed.error}</span>
      )}
    </div>
  );
}

function TransportStatusPanel({ delivery, observability }) {
  const d = delivery || {};
  const o = observability || {};
  return (
    <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Transport status</div>
      <div
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
        }}
      >
        {JSON.stringify(
          {
            delivery: {
              phase: d.phase,
              ready: d.ready,
              connection: d.connection,
              capabilities: d.capabilities,

              targetParams: d.targetParams,
              lastSentRevision: d.lastSentRevision,
              lastSentParams: d.lastSentParams,

              lastRevisionApplied: d.lastRevisionApplied,
              lastAppliedParams: d.lastAppliedParams,
              clampDelta: d.clampDelta,
              latencyMs: d.latencyMs,
              lastError: d.lastError,
            },
            observability: {
              health: o.health,
              telemetryStale: o.telemetryStale,
              stableStale: o.stableStale,
              lastTelemetryAtMs: o.lastTelemetryAtMs,
              telemetry: o.telemetry,
              lastStableAtMs: o.lastStableAtMs,
              stableSeq: o.stableSeq,
              basedOnTelemetryAtMs: o.basedOnTelemetryAtMs,
              lastStableSentAtMs: o.lastStableSentAtMs,
              stableComputeLagMs: o.stableComputeLagMs,
              supportedTelemetryFields: o.supportedTelemetryFields,
              stableStats: o.stableStats,

              bus: {
                busLastAtMs: o.busLastAtMs,
                mathLastAtMs: o.mathLastAtMs,
                placementLastAtMs: o.placementLastAtMs,
                physicsLastAtMs: o.physicsLastAtMs,
              },
              placement: {
                placementLastGridSnapAtMs: o.placementLastGridSnapAtMs,
                placementLastCell: o.placementLastCell,
                placementLastCubeSize: o.placementLastCubeSize,
                placementLastFaceResolveAtMs: o.placementLastFaceResolveAtMs,
                placementLastResolvedFace: o.placementLastResolvedFace,
                placementLastAnchorCommitAtMs: o.placementLastAnchorCommitAtMs,
                placementLastAnchorKind: o.placementLastAnchorKind,
                placementLastAnchorCell: o.placementLastAnchorCell,
                placementLastAnchorFace: o.placementLastAnchorFace,
                placementLastAnchorAccepted: o.placementLastAnchorAccepted,
                placementLastAnchorReason: o.placementLastAnchorReason,
              },
              math: {
                mathLastFieldSampleAtMs: o.mathLastFieldSampleAtMs,
                mathLastHeight: o.mathLastHeight,
                mathLastNormal: o.mathLastNormal,
                mathLastEnergy: o.mathLastEnergy,
                mathLastOrientationAtMs: o.mathLastOrientationAtMs,
                mathLastFace: o.mathLastFace,
                mathLastSpinRad: o.mathLastSpinRad,
                mathLastQuaternion: o.mathLastQuaternion,
              },
              assets: {
                assetLastAtMs: o.assetLastAtMs,
                assetLastSeq: o.assetLastSeq,
                assetsLastEventAtMs: o.assetsLastEventAtMs,
                assetsLastEventType: o.assetsLastEventType,
                assetsLastEventKey: o.assetsLastEventKey,
                assetsWarnings: o.assetsWarnings,
                assetsMemory: o.assetsMemory,
                assetsByKeyCount: o.assetsByKey ? Object.keys(o.assetsByKey).length : 0,
                assetsRecentErrors: o.assetsRecentErrors,
                assetsRecentEvictions: o.assetsRecentEvictions,
              },
            },
          },
          null,
          2,
        )}
      </div>
    </div>
  );
}

PreviewResult.propTypes = {
  computed: PropTypes.shape({
    ok: PropTypes.bool.isRequired,
    result: PropTypes.number,
    error: PropTypes.string,
  }).isRequired,
};

TransportStatusPanel.propTypes = {
  delivery: PropTypes.shape({
    phase: PropTypes.any,
    ready: PropTypes.any,
    connection: PropTypes.any,
    capabilities: PropTypes.any,

    lastTelemetryAtMs: PropTypes.any,
    telemetry: PropTypes.any,
    stableStats: PropTypes.any,

    targetParams: PropTypes.any,
    lastSentRevision: PropTypes.any,
    lastSentParams: PropTypes.any,

    lastRevisionApplied: PropTypes.any,
    lastAppliedParams: PropTypes.any,
    clampDelta: PropTypes.any,
    latencyMs: PropTypes.any,
    lastError: PropTypes.any,
  }),
  observability: PropTypes.shape({
    health: PropTypes.any,
    telemetryStale: PropTypes.any,
    stableStale: PropTypes.any,
    lastTelemetryAtMs: PropTypes.any,
    telemetry: PropTypes.any,
    lastStableAtMs: PropTypes.any,
    stableSeq: PropTypes.any,
    basedOnTelemetryAtMs: PropTypes.any,
    stableStats: PropTypes.any,
  }),
};

export function DiagnosticPage() {
  const { routeToGame, delivery, observability } = useMathRouter();

  const [expression, setExpression] = useState('2*(x+3)');
  const [x, setX] = useState(4);

  const variables = useMemo(() => ({ x }), [x]);

  const computed = useMemo(() => {
    try {
      const result = evaluate(expression, variables);
      if (!Number.isFinite(result)) {
        return { ok: false, error: 'Result is not finite' };
      }
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }, [expression, variables]);

  const onRoute = () => {
    if (!computed.ok) return;

    routeToGame({
      expression,
      variables,
      result: computed.result,
      schemaVersion: 1,
    });
  };

  return (
    <div style={{ padding: 16, maxWidth: 700 }}>
      <h1>Diagnostic</h1>

      <label style={{ display: 'block', marginTop: 12 }}>
        <span>Expression</span>
        <input
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          style={{ width: '100%', padding: 8, marginTop: 6 }}
        />
      </label>

      <label style={{ display: 'block', marginTop: 12 }}>
        <span>x</span>
        <input
          type="number"
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
          style={{ width: '100%', padding: 8, marginTop: 6 }}
        />
      </label>

      <PreviewResult computed={computed} />

      <TransportStatusPanel delivery={delivery} observability={observability} />

      <button
        onClick={onRoute}
        disabled={!computed.ok}
        style={{
          marginTop: 16,
          padding: '10px 14px',
          cursor: computed.ok ? 'pointer' : 'not-allowed',
        }}
      >
        Route math to Game
      </button>
    </div>
  );
}
