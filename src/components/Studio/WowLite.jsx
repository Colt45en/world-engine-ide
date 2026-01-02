import './Studio.css';

import PropTypes from 'prop-types';
import { useRef, useState } from 'react';
import { useWowLiteHostBridge } from '../../control-plane/useWowLiteHostBridge';
import { HudRoot } from '../../ui/HudRoot';
import WowLiteApp from '../WowLite/WowLiteApp';

const WowLite = ({
  iframeRef,
  compact = false,
  defaultEmbedded = true,
  defaultUseReact = false,
  showHud = true,
}) => {
  const [embedded, setEmbedded] = useState(Boolean(defaultEmbedded));
  const [useReact, setUseReact] = useState(Boolean(defaultUseReact));
  const localIframeRef = useRef(null);
  const effectiveIframeRef = iframeRef || localIframeRef;

  const effectiveEmbedded = compact ? true : embedded;
  const effectiveUseReact = useReact;

  // If a parent passes iframeRef (e.g. GamePage), it likely owns the bridge.
  useWowLiteHostBridge(effectiveIframeRef, {
    enabled: !iframeRef && effectiveEmbedded && !effectiveUseReact,
  });

  let frameContent = null;
  if (effectiveUseReact) {
    frameContent = (
      <div style={{ width: '100%', height: 720 }}>
        <WowLiteApp />
      </div>
    );
  } else if (effectiveEmbedded) {
    frameContent = (
      <iframe
        ref={effectiveIframeRef}
        title="WoW-Lite"
        src="/tools/wow-lite.html"
        style={{ border: '0', width: '100%', height: '720px' }}
        sandbox="allow-scripts allow-same-origin"
      />
    );
  } else {
    frameContent = (
      <div style={{ padding: 20 }}>
        <p>
          Tool is in new tab mode. Click{' '}
          <a href="/tools/wow-lite.html" target="_blank" rel="noreferrer">
            Open in new tab
          </a>{' '}
          to launch.
        </p>
      </div>
    );
  }

  if (compact) {
    return <div className="studio-tool-frame">{frameContent}</div>;
  }

  return (
    <div className="studio-tool-container">
      {showHud ? <HudRoot /> : null}
      <div className="studio-tool-header">
        <h2>WoW-Lite Prototype</h2>
        <div className="studio-tool-actions">
          <button type="button" className="btn" onClick={() => setEmbedded(!embedded)}>
            {embedded ? 'Open in new tab' : 'Show embedded'}
          </button>
          <a className="btn" href="/tools/wow-lite.html" target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>
      </div>

      <div className="studio-tool-frame">
        <div style={{ padding: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setEmbedded(!embedded)}>
            {embedded ? 'Open in new tab' : 'Show embedded'}
          </button>
          <button className="btn" onClick={() => setUseReact((prev) => !prev)}>
            {useReact ? 'Use Iframe' : 'Use React Canvas'}
          </button>
          <a className="btn" href="/tools/wow-lite.html" target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>

        {frameContent}
      </div>

      <div className="studio-tool-note text-muted">
        The demo runs as a static tool. Use embedded view for quick testing or open in a new tab for
        full-screen play.
      </div>
    </div>
  );
};

WowLite.propTypes = {
  iframeRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  compact: PropTypes.bool,
  defaultEmbedded: PropTypes.bool,
  defaultUseReact: PropTypes.bool,
  showHud: PropTypes.bool,
};

export default WowLite;
