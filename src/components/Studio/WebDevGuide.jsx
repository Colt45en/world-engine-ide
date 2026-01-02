import { useState } from 'react';
import './Studio.css';

const WebDevGuide = () => {
  const [embedded, setEmbedded] = useState(true);

  return (
    <div className="studio-tool-container">
      <div className="studio-tool-header">
        <h2>Web Development Guide</h2>
        <div className="studio-tool-actions">
          <button type="button" className="btn" onClick={() => setEmbedded(!embedded)}>
            {embedded ? 'Open in new tab' : 'Show embedded'}
          </button>
          <a className="btn" href="/web-dev-guide.html" target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>
      </div>

      <div className="studio-tool-frame">
        {embedded ? (
          <iframe
            title="Web Dev Guide"
            src="/web-dev-guide.html"
            style={{ border: '0', width: '100%', height: '720px' }}
            sandbox="allow-same-origin"
          />
        ) : (
          <div style={{ padding: 20 }}>
            <p>
              Tool is in new tab mode. Click{' '}
              <a href="/web-dev-guide.html" target="_blank" rel="noreferrer">
                Open in new tab
              </a>{' '}
              to launch.
            </p>
          </div>
        )}
      </div>

      <div className="studio-tool-note text-muted">
        A static guide page with tutorials and examples. Use embedded view for quick reading or open
        in a new tab for full page.
      </div>
    </div>
  );
};

export default WebDevGuide;
