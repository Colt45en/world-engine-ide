import './NeuralCore.css';

const NeuralCore = () => {
  return (
    <div className="neural-core">
      <div className="glow-sphere" />

      <div className="canvas-container">
        <svg id="nexus-logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path className="frame-path" d="M100 20 L170 60 L170 140 L100 180 L30 140 L30 60 Z" />

          <line
            className="connection"
            x1="100"
            y1="60"
            x2="60"
            y2="100"
            style={{ animationDelay: '0s' }}
          />
          <line
            className="connection"
            x1="100"
            y1="60"
            x2="140"
            y2="100"
            style={{ animationDelay: '1s' }}
          />
          <line
            className="connection"
            x1="60"
            y1="100"
            x2="100"
            y2="140"
            style={{ animationDelay: '2s' }}
          />
          <line
            className="connection"
            x1="140"
            y1="100"
            x2="100"
            y2="140"
            style={{ animationDelay: '0.5s' }}
          />
          <line
            className="connection"
            x1="100"
            y1="60"
            x2="100"
            y2="140"
            style={{ animationDelay: '1.5s' }}
          />

          <g>
            <circle className="node" cx="100" cy="60" r="6" />
            <circle className="node-inner" cx="100" cy="60" r="2" />
          </g>

          <g>
            <circle className="node" cx="60" cy="100" r="6" />
            <circle className="node-inner" cx="60" cy="100" r="2" />
          </g>

          <g>
            <circle className="node" cx="140" cy="100" r="6" />
            <circle className="node-inner" cx="140" cy="100" r="2" />
          </g>

          <g>
            <circle className="node" cx="100" cy="140" r="6" />
            <circle className="node-inner" cx="100" cy="140" r="2" />
          </g>

          <g>
            <circle className="node" cx="100" cy="100" r="4" />
            <circle className="node-inner" cx="100" cy="100" r="1.5" />
          </g>
        </svg>
      </div>

      <div className="brand-container">
        <div>
          <span className="brand-ai">AI</span>
          <span className="brand-nexus">Nexus</span>
        </div>
        <div className="tagline">Neural Network Core</div>
      </div>
    </div>
  );
};

export default NeuralCore;
