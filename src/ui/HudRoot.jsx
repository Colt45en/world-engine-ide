import { useMemo, useState } from 'react';
import { useObservability } from '../state/useObservability';
import { useUiActions } from '../state/useUiActions';
import './hud.css';
import { MiniMap } from './MiniMap';
import { PanelStack } from './PanelStack';

export function HudRoot() {
  const obs = useObservability();
  const actions = useUiActions();
  const [activePanel, setActivePanel] = useState(null);

  let health = 'UNKNOWN';
  if (obs && obs.observability && obs.observability.stableStats) {
    health = obs.observability.stableStats.health;
  } else if (obs && obs.observability) {
    health = obs.observability.health;
  }

  const healthLabel = typeof health === 'string' ? health : 'UNKNOWN';

  const statusText = useMemo(() => {
    const stableFps =
      obs && obs.observability && obs.observability.stableStats
        ? obs.observability.stableStats.stableFps
        : null;
    if (typeof stableFps === 'number') return `FPS: ${stableFps.toFixed(1)}`;
    return 'FPS: —';
  }, [obs]);

  return (
    <div className="hud-root" aria-label="HUD Overlay">
      <div className="hud-topright" aria-label="HUD Status">
        <div className="hud-pill">
          <div className="hud-pill-row">
            <span>Health:</span>
            <strong>{healthLabel}</strong>
          </div>
          <div className="hud-pill-row hud-pill-secondary">{statusText}</div>
        </div>
      </div>

      <div className="hud-bottomright" aria-label="HUD Dock">
        <PanelStack
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          obs={obs}
          actions={actions}
        />

        <MiniMap
          obs={obs}
          onPing={() => actions.pingMap()}
          onTogglePanel={(panel) => {
            setActivePanel((p) => (p === panel ? null : panel));
          }}
        />
      </div>
    </div>
  );
}
