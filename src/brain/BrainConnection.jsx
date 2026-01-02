import PropTypes from 'prop-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const BrainConnectionContext = createContext(null);

const DEFAULT_WS_URL = import.meta.env?.VITE_BRAIN_RELAY_URL;

const RELAY_URL_QUERY_KEY = 'brainRelayUrl';
const RELAY_URL_STORAGE_KEY = 'brainRelayUrl';

function resolveDefaultWsUrl() {
  // 1) Build-time env (preferred)
  if (DEFAULT_WS_URL) return DEFAULT_WS_URL;

  // 2) Runtime override via query string (persist to localStorage)
  try {
    const url = globalThis?.location?.href;
    if (typeof url === 'string') {
      const qs = new URL(url).searchParams;
      const fromQuery = qs.get(RELAY_URL_QUERY_KEY);
      if (fromQuery) {
        globalThis?.localStorage?.setItem(RELAY_URL_STORAGE_KEY, fromQuery);
        return fromQuery;
      }
    }
  } catch {
    // ignore
  }

  // 3) Runtime override via localStorage
  try {
    const fromStorage = globalThis?.localStorage?.getItem(RELAY_URL_STORAGE_KEY);
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }

  return undefined;
}

/**
 * @typedef {'connecting'|'connected'|'disconnected'} BrainConnectionStatus
 */

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function BrainConnectionProvider({ children, wsUrl = resolveDefaultWsUrl() }) {
  /** @type {[BrainConnectionStatus, Function]} */
  const [status, setStatus] = useState('disconnected');
  const [sessionId, setSessionId] = useState(null);
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const [lastError, setLastError] = useState(null);

  const wsRef = useRef(/** @type {WebSocket|null} */ (null));
  const connectRef = useRef(/** @type {null | (() => void)} */ (null));
  const retryRef = useRef({ attempt: 0, timer: /** @type {any} */ (null) });
  const unmountedRef = useRef(false);

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    try {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close();
    } catch {
      // ignore
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;
    if (retryRef.current.timer) return;

    retryRef.current.attempt += 1;
    const attempt = retryRef.current.attempt;
    const delayMs = Math.min(5000, 250 * Math.pow(1.6, attempt));

    retryRef.current.timer = setTimeout(() => {
      retryRef.current.timer = null;
      if (connectRef.current) connectRef.current();
    }, delayMs);
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    if (!wsUrl) {
      setStatus('disconnected');
      setSessionId(null);
      setLastError(null);
      return;
    }

    // If we're already connected/connecting, don't start a second socket.
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
    )
      return;

    setStatus('connecting');
    setLastError(null);

    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      setStatus('disconnected');
      const detail = err instanceof Error ? err.message : String(err);
      setLastError(
        detail ? `WebSocket construction failed: ${detail}` : 'WebSocket construction failed',
      );
      scheduleReconnect();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current.attempt = 0;
      setStatus('connected');
      setLastError(null);

      try {
        ws.send(JSON.stringify({ cmd: 'CreateSession', owner: 'nexus-ui' }));
      } catch {
        // ignore
      }
    };

    ws.onmessage = (evt) => {
      const msg = safeJsonParse(evt.data);
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'SessionCreated' && typeof msg.session_id === 'string') {
        setSessionId(msg.session_id);
        return;
      }

      if (msg.type === 'State.Snapshot' && msg.state && typeof msg.state === 'object') {
        setLastSnapshot(msg.state);
      }
    };

    ws.onerror = () => {
      // Most browsers do not provide useful details.
      setLastError('WebSocket error');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setSessionId(null);
      scheduleReconnect();
    };
  }, [scheduleReconnect, wsUrl]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (retryRef.current.timer) {
        clearTimeout(retryRef.current.timer);
        retryRef.current.timer = null;
      }
      closeSocket();
    };
  }, [closeSocket, connect]);

  const sendJson = useCallback((obj) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }, []);

  const applyOperator = useCallback(
    (operator, params = {}) => {
      if (!sessionId) return false;
      return sendJson({
        cmd: 'ApplyOperator',
        session_id: sessionId,
        operator,
        params,
      });
    },
    [sendJson, sessionId],
  );

  const value = useMemo(() => {
    return {
      wsUrl,
      status,
      sessionId,
      lastSnapshot,
      lastError,
      sendJson,
      applyOperator,
    };
  }, [applyOperator, lastError, lastSnapshot, sendJson, sessionId, status, wsUrl]);

  return (
    <BrainConnectionContext.Provider value={value}>{children}</BrainConnectionContext.Provider>
  );
}

BrainConnectionProvider.propTypes = {
  children: PropTypes.node,
  wsUrl: PropTypes.string,
};

export function useBrainConnection() {
  const ctx = useContext(BrainConnectionContext);
  if (!ctx) throw new Error('useBrainConnection must be used within <BrainConnectionProvider>');
  return ctx;
}
