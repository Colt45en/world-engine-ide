import './Studio.css';

import { useState } from 'react';

const NexusDual = () => {
  const [embedded, setEmbedded] = useState(true);

  return (
    <div className="studio-tool-container">
      <div className="studio-tool-header">
        <h2>NEXUS Dual-Sandbox Demo</h2>
        <div className="studio-tool-actions">
          <button type="button" className="btn" onClick={() => setEmbedded(!embedded)}>
            {embedded ? 'Open in new tab' : 'Show embedded'}
          </button>
          <a className="btn" href="/tools/nexus-dual.html" target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>
      </div>

      <div className="studio-tool-frame">
        {embedded ? (
          <iframe
            title="Nexus Dual Sandbox"
            src="/tools/nexus-dual.html"
            style={{ border: '0', width: '100%', height: '720px' }}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div style={{ padding: 20 }}>
            <p>
              Tool is in new tab mode. Click{' '}
              <a href="/tools/nexus-dual.html" target="_blank" rel="noreferrer">
                Open in new tab
              </a>{' '}
              to launch.
            </p>
          </div>
        )}
      </div>

      <div className="studio-tool-note text-muted">
        The demo runs in two hidden iframes (Brain + Codepad) and uses postMessage broker wiring.
      </div>
    </div>
  );
};

export default NexusDual;
