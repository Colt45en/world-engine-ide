import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import './NeuralCore.css';

// Lightweight NeuralCore UI for Nexus
// - Provides LOD / viewport subscription controls (client-side)
// - Calls a pluggable brain API: `window.brainOp` or `window.parent?.brainOp`
// - Renders very small preview of entities returned from the brain

const DEFAULT_POLL_FPS = 4;

const findBrainOp = () => {
  if (typeof globalThis === 'undefined') return null;
  if (typeof globalThis.brainOp === 'function') return globalThis.brainOp;
  if (globalThis.parent && typeof globalThis.parent.brainOp === 'function')
    return globalThis.parent.brainOp;
  return null;
};

const NeuralCore = ({ initialBounds = { x: 0, y: 0, w: 1000, h: 1000 } }) => {
  const [running, setRunning] = useState(false);
  const [fps, setFps] = useState(DEFAULT_POLL_FPS);
  const [lod, setLod] = useState(1); // integer LOD (0=highest detail, higher = more coarse)
  const [count, setCount] = useState(0);
  const [lastMs, setLastMs] = useState(0);
  const [lastPayloadBytes, setLastPayloadBytes] = useState(0);
  const [entities, setEntities] = useState([]);
  const [subscribed, setSubscribed] = useState(false);
  const [listenRender, setListenRender] = useState(false);
  const subIdRef = useRef(null);
  const canvasRef = useRef(null);
  const brainOp = findBrainOp();
  const boundsRef = useRef(initialBounds);
  const subListenerRef = useRef(null);
  const renderListenerRef = useRef(null);

  // Poll function — pluggable to your brain API
  const poll = async () => {
    if (!brainOp) return;
    const start = performance.now();
    try {
      // contract: getState({ bounds, lod, limit }) => { snapshot: { entities: {...} }, total }
      const payload = await brainOp('getState', [{ bounds: boundsRef.current, lod, limit: 2000 }]);
      const res = payload && payload.res;
      const duration = performance.now() - start;
      setLastMs(Math.round(duration));
      const payloadStr = JSON.stringify(res || {});
      setLastPayloadBytes(payloadStr.length);
      const list =
        res && res.value && res.value.snapshot && res.value.snapshot.entities
          ? Object.values(res.value.snapshot.entities)
          : [];
      setEntities(list);
      setCount(list.length);
    } catch (err) {
      // non-fatal: log and stop polling if fatal error reported
      // eslint-disable-next-line no-console
      console.warn('NeuralCore poll failed', err);
    }
  };

  // Subscribe / Unsubscribe helpers
  const subscribeToState = async () => {
    if (!brainOp) return;
    try {
      const opts = { bounds: boundsRef.current, lod, fps };
      const payload = await brainOp('subscribeState', [opts]);
      const res = payload && payload.res;
      if (res && res.ok && res.value && res.value.subId) {
        subIdRef.current = res.value.subId;
        setSubscribed(true);
        const handler = (e) => {
          const m = e.data;
          if (!m || !m.__nexus) return;
          if (
            m.from === 'brain' &&
            m.kind === 'BRAIN_SUB' &&
            m.payload &&
            m.payload.subId === subIdRef.current
          ) {
            const snap = m.payload.snapshot;
            const list = snap && snap.entities ? Object.values(snap.entities) : [];
            setEntities(list);
            setCount(list.length);
            setLastPayloadBytes(JSON.stringify(m.payload).length);
          }
        };
        subListenerRef.current = handler;
        window.addEventListener('message', handler);
      }
    } catch (e) {
      console.warn('subscribe failed', e);
    }
  };

  const unsubscribeFromState = async () => {
    if (!brainOp || !subIdRef.current) return;
    try {
      await brainOp('unsubscribeState', [subIdRef.current]);
    } catch (e) {
      console.warn('notify sub failed', e);
    }
    if (subListenerRef.current) window.removeEventListener('message', subListenerRef.current);
    subListenerRef.current = null;
    subIdRef.current = null;
    setSubscribed(false);
  };

  // Render rebroadcast listener (parent -> window) to receive RENDER frames
  const subscribeToRender = () => {
    if (renderListenerRef.current) return;
    const handler = (e) => {
      const m = e.data;
      if (!m || !m.__nexus) return;
      if (m.from !== 'parent' || m.kind !== 'RENDER') return;
      const p = m.payload || {};
      const list = Array.isArray(p.entities) ? p.entities : [];
      setEntities(list);
      setCount(list.length);
    };
    renderListenerRef.current = handler;
    window.addEventListener('message', handler);
    setListenRender(true);
  };

  const unsubscribeFromRender = () => {
    if (renderListenerRef.current) window.removeEventListener('message', renderListenerRef.current);
    renderListenerRef.current = null;
    setListenRender(false);
  };

  // Start/stop polling loop
  useEffect(() => {
    if (!running) return undefined;
    const interval = 1000 / Math.max(0.1, fps);
    let mounted = true;
    let timer = null;
    const tick = async () => {
      if (!mounted) return;
      await poll();
      timer = setTimeout(tick, interval);
    };
    tick();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [running, fps, lod]);

  // Simple canvas renderer for preview (draws coarse circles)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    ctx.clearRect(0, 0, w, h);
    // compute mapping: world bounds -> canvas
    const b = boundsRef.current;
    const scaleX = w / Math.max(1, b.w);
    const scaleY = h / Math.max(1, b.h);

    ctx.fillStyle = '#0e1116';
    ctx.fillRect(0, 0, w, h);

    for (const e of entities) {
      const x = (e.x - b.x) * scaleX;
      const y = (e.y - b.y) * scaleY;
      const r = Math.max(1, (e.r || 4) * Math.max(scaleX, scaleY));
      ctx.beginPath();
      ctx.fillStyle = e.color || '#4dd0e1';
      ctx.globalAlpha = Math.max(0.15, 1 - Math.min(2, lod) * 0.25);
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [entities, lod]);

  // cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (subListenerRef.current) window.removeEventListener('message', subListenerRef.current);
      if (renderListenerRef.current)
        window.removeEventListener('message', renderListenerRef.current);
      if (subIdRef.current && brainOp) {
        try {
          brainOp('unsubscribeState', [subIdRef.current]);
        } catch (e) {
          console.warn('unsubscribe failed', e);
        }
      }
    };
  }, []);

  return (
    <div className="neural-core">
      <div className="neural-core-controls">
        <div className="controls-row">
          <button type="button" onClick={() => setRunning((s) => !s)}>
            {running ? 'Stop' : 'Start'} Poll
          </button>
          <button
            type="button"
            onClick={async () => {
              if (subscribed) await unsubscribeFromState();
              else await subscribeToState();
            }}
          >
            {subscribed ? 'Unsubscribe' : 'Subscribe'}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (renderListenerRef.current) unsubscribeFromRender();
              else subscribeToRender();
            }}
          >
            {listenRender ? 'Stop Render Listen' : 'Listen Render'}
          </button>
          <label>
            FPS:{' '}
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value) || DEFAULT_POLL_FPS)}
            />
          </label>
          <label>
            LOD:{' '}
            <input
              type="range"
              min="0"
              max="3"
              value={lod}
              onChange={(e) => setLod(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="status-row">
          <div>
            Entities: <strong>{count}</strong>
          </div>
          <div>
            Last fetch: <strong>{lastMs} ms</strong>
          </div>
          <div>
            Payload: <strong>{lastPayloadBytes} bytes</strong>
          </div>
        </div>

        <div className="canvas-wrap">
          <canvas ref={canvasRef} className="preview-canvas" />
        </div>

        <div className="integration-note">
          <small>
            Integration: implement your Brain&apos;s <code>getState</code> and optional{' '}
            <code>subscribeState</code> endpoints — e.g.{' '}
            <code>brainOp(&apos;getState&apos;, params)</code> or{' '}
            <code>brainOp(&apos;subscribeState&apos;, params)</code>.
          </small>
        </div>
      </div>
    </div>
  );
};

NeuralCore.propTypes = {
  initialBounds: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    w: PropTypes.number,
    h: PropTypes.number,
  }),
};

NeuralCore.defaultProps = {
  initialBounds: { x: 0, y: 0, w: 1000, h: 1000 },
};

export default NeuralCore;
