import PropTypes from 'prop-types';
import './minimap.css';
import { MiniMapCanvas } from './minimap/MiniMapCanvas';

export function MiniMap({ obs, onPing, onTogglePanel }) {
  const player =
    obs && obs.observability && obs.observability.telemetry
      ? obs.observability.telemetry.position
      : null;

  const playerPos =
    player && typeof player.x === 'number' && typeof player.z === 'number'
      ? { x: player.x, z: player.z }
      : null;

  const zoom =
    obs && obs.observability && typeof obs.observability.uiMinimapZoom === 'number'
      ? obs.observability.uiMinimapZoom
      : 1;

  const cubeSize =
    obs && obs.observability && typeof obs.observability.placementLastCubeSize === 'number'
      ? obs.observability.placementLastCubeSize
      : 2;

  const anchors =
    obs && obs.observability && Array.isArray(obs.observability.placementAnchors)
      ? obs.observability.placementAnchors
      : [];

  const stableFps =
    obs && obs.observability && obs.observability.stableStats
      ? obs.observability.stableStats.stableFps
      : null;

  return (
    <div className="minimap-card" aria-label="Mini-map">
      <div className="minimap-header">
        <div className="minimap-title">Mini-Map</div>
        <div className="minimap-actions">
          <button type="button" className="hud-btn" onClick={() => onTogglePanel('inventory')}>
            Bag
          </button>
          <button type="button" className="hud-btn" onClick={() => onTogglePanel('quests')}>
            Quests
          </button>
          <button type="button" className="hud-btn" onClick={() => onTogglePanel('settings')}>
            Settings
          </button>
        </div>
      </div>

      <div className="minimap-canvas" aria-label="Mini-map canvas">
        <MiniMapCanvas
          sizePx={180}
          cubeSize={cubeSize}
          zoom={zoom}
          anchors={anchors}
          playerPos={playerPos}
          uiHz={10}
        />
      </div>

      <div className="minimap-footer">
        <div className="minimap-meta">
          {player
            ? `P: ${player.x.toFixed(1)},${player.y.toFixed(1)},${player.z.toFixed(1)}`
            : 'P: —'}
        </div>
        <div className="minimap-meta">
          FPS: {typeof stableFps === 'number' ? stableFps.toFixed(1) : '—'}
        </div>
        <button type="button" className="hud-btn" onClick={onPing}>
          Ping
        </button>
      </div>
    </div>
  );
}

MiniMap.propTypes = {
  obs: PropTypes.any,
  onPing: PropTypes.func,
  onTogglePanel: PropTypes.func,
};
