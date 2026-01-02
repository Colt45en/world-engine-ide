import { useEffect, useState } from 'react';
import { useBrainConnection } from '../brain/BrainConnection.jsx';
import './Nexus.css';

function Hud() {
  const { status, sessionId, lastSnapshot, lastError, applyOperator } = useBrainConnection();
  const connected = status === 'connected';

  const applyST = () => {
    applyOperator('ST', { changes: { tick: Date.now() } });
  };

  return (
    <div className="hud">
      <div className="hud-row">
        <div>Brain: {connected ? <strong>connected</strong> : status}</div>
        <div>session: {sessionId || '—'}</div>
        <div>
          <button type="button" onClick={applyST} disabled={!connected || !sessionId}>
            Apply ST
          </button>
        </div>
      </div>
      {lastError ? <div className="hud-row">error: {lastError}</div> : null}
      <div className="hud-body">
        <pre>{lastSnapshot ? JSON.stringify(lastSnapshot, null, 2) : 'No snapshot yet'}</pre>
      </div>
    </div>
  );
}

export default function Nexus() {
  const [tab, setTab] = useState('trainer');

  useEffect(() => {
    // set the default tab
    setTab('trainer');
  }, []);

  return (
    <div className="nexus-page">
      <nav className="nexus-nav">
        <div className="brand">
          nexus<span className="forge">forge</span>
        </div>
        <div className="nav-links">
          <button type="button" onClick={() => document.getElementById('top')?.scrollIntoView()}>
            Top
          </button>
        </div>
      </nav>

      <header id="top" className="nexus-hero">
        <div className="hero-inner">
          <div className="badge">Live: UI kit + Trainer + 3D Sandbox</div>
          <h1>Nexus Web Forge</h1>
          <p>
            One place to <strong>learn</strong>, <strong>build</strong>, and{' '}
            <strong>experiment</strong>.
          </p>
          <div className="hero-cta">
            <button type="button" className="cta">
              Start a Track
            </button>
            <button type="button" className="cta outline" onClick={() => setTab('sandbox')}>
              Open Lab
            </button>
          </div>

          <div className="hero-cards">
            <div>Focus — HTML • CSS • JS</div>
            <div>Mode — Practice-first</div>
            <div>Output — Reusable components</div>
            <div>Lab — 3D + SVG HUD</div>
          </div>
        </div>
      </header>

      <section id="lab" className="lab-section">
        <div className="lab-inner">
          <div className="lab-controls">
            <button
              type="button"
              className={tab === 'trainer' ? 'active' : ''}
              onClick={() => setTab('trainer')}
            >
              📖 Trainer
            </button>
            <button
              type="button"
              className={tab === 'sandbox' ? 'active' : ''}
              onClick={() => setTab('sandbox')}
            >
              🎨 Sandbox
            </button>
          </div>

          <div className="lab-content">
            <div className={`trainer ${tab === 'trainer' ? 'visible' : 'hidden'}`}>
              <h3>Trainer overview</h3>
              <p>
                The spine: concepts → micro-builds → integration projects → refactor into reusable
                components.
              </p>
            </div>

            <div className={`sandbox ${tab === 'sandbox' ? 'visible' : 'hidden'}`}>
              <div className="sandbox-canvas">
                (3D sandbox placeholder — Three.js can mount here)
              </div>
              <div className="sandbox-hud">
                <Hud />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
