import { getBus } from '../bus/bus';

function nowMs() {
  return Date.now();
}

export function useUiActions() {
  const bus = getBus();

  return {
    pingMap() {
      bus.emit({ channel: 'UI', type: 'MINIMAP_PING', payload: {}, atMs: nowMs() });
    },
    sortInventory() {
      bus.emit({ channel: 'UI', type: 'INVENTORY_SORT', payload: {}, atMs: nowMs() });
    },
    setTelemetryEnabled(enabled) {
      bus.emit({
        channel: 'UI',
        type: 'SET_TELEMETRY_ENABLED',
        payload: { enabled: Boolean(enabled) },
        atMs: nowMs(),
      });
    },
    setMinimapZoom(zoom) {
      bus.emit({ channel: 'UI', type: 'MINIMAP_ZOOM', payload: { zoom }, atMs: nowMs() });
    },
  };
}
