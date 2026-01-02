import PropTypes from 'prop-types';
import './panels.css';

function readBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value, fallback) {
  return typeof value === 'number' ? value : fallback;
}

export function PanelStack({ activePanel, setActivePanel, obs, actions }) {
  if (!activePanel) return null;

  let title = '';
  let body = null;

  switch (activePanel) {
    case 'inventory': {
      title = 'Inventory Bag';
      const items =
        obs && obs.inventory && Array.isArray(obs.inventory.items) ? obs.inventory.items : [];

      body = (
        <div className="panel-body">
          {items.length === 0 ? (
            <div className="panel-muted">No items.</div>
          ) : (
            items.map((it) => (
              <div className="panel-row" key={it.id || it.name}>
                {it.name} × {it.qty}
              </div>
            ))
          )}
          <div className="panel-actions">
            <button type="button" className="hud-btn" onClick={() => actions.sortInventory()}>
              Sort
            </button>
          </div>
        </div>
      );
      break;
    }
    case 'quests': {
      title = 'Quest Log';
      const quests = obs && obs.quests && Array.isArray(obs.quests.active) ? obs.quests.active : [];

      body = (
        <div className="panel-body">
          {quests.length === 0 ? (
            <div className="panel-muted">No active quests.</div>
          ) : (
            quests.map((q) => (
              <div className="panel-row" key={q.id || q.title}>
                {q.title}
              </div>
            ))
          )}
        </div>
      );
      break;
    }
    case 'settings': {
      title = 'Settings';

      const uiTelemetryEnabled = readBoolean(obs?.observability?.uiTelemetryEnabled, true);
      const uiMinimapZoom = readNumber(obs?.observability?.uiMinimapZoom, 1);

      body = (
        <div className="panel-body">
          <div className="panel-row">
            <span>Show Telemetry</span>
            <input
              type="checkbox"
              checked={uiTelemetryEnabled}
              onChange={(e) => actions.setTelemetryEnabled(Boolean(e.target.checked))}
            />
          </div>
          <div className="panel-row">
            <span>MiniMap Zoom</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={uiMinimapZoom}
              onChange={(e) => actions.setMinimapZoom(Number(e.target.value))}
            />
          </div>
        </div>
      );
      break;
    }
    default: {
      break;
    }
  }

  return (
    <div className="panel-card" aria-label="HUD Panel">
      <div className="panel-header">
        <div className="panel-title">{title}</div>
        <button type="button" className="hud-btn" onClick={() => setActivePanel(null)}>
          Close
        </button>
      </div>
      {body}
    </div>
  );
}

PanelStack.propTypes = {
  activePanel: PropTypes.any,
  setActivePanel: PropTypes.func,
  obs: PropTypes.any,
  actions: PropTypes.any,
};
