/* eslint-disable react/no-unescaped-entities, react/jsx-no-comment-textnodes */
import { Activity, Code, Database, Eye, Layers, Terminal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBus } from '../../bus/bus';
import { languageDomTreeToPseudoHtmlLines } from '../../core/lang/language-dom-tree.js';

function safeJsonParse(str) {
  try {
    return { ok: true, value: JSON.parse(str) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

// Tree-building helpers live in src/core/lang/language-dom-tree.js

const TurtleStack = () => {
  const [activeLayer, setActiveLayer] = useState('composite');
  const bus = useMemo(() => getBus(), []);
  const lastRequestedUrlRef = useRef(null);
  const manualReloadUrlRef = useRef(null);
  const jsonStateRef = useRef('');
  const parsedDataRef = useRef({});

  const initialJson = useMemo(
    () =>
      JSON.stringify(
        {
          title: 'The Turtle Stack',
          description: 'A multi-layered agricultural embedding method.',
          accentColor: 'emerald',
          interactive: true,
          webhint: {
            feedUrl: '/webhint-feed.json',
            status: 'not_loaded',
            hintReportOnly: true,
          },
        },
        null,
        2,
      ),
    [],
  );

  // The "Johnson" (JSON) Layer - The Base Truth
  const [jsonState, setJsonState] = useState(initialJson);

  // Parsed state for use in other layers
  const [parsedData, setParsedData] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    const parsed = safeJsonParse(jsonState);
    if (parsed.ok) {
      setParsedData(parsed.value);
      setError(null);
    } else {
      setError('Invalid Johnson (JSON) Syntax');
    }
  }, [jsonState]);

  useEffect(() => {
    jsonStateRef.current = jsonState;
  }, [jsonState]);

  useEffect(() => {
    parsedDataRef.current = parsedData;
  }, [parsedData]);

  // Load webhint feed via the engine bus and hydrate state from WEBHINT events.
  useEffect(() => {
    const feedUrl = parsedData && parsedData.webhint && parsedData.webhint.feedUrl;
    if (typeof feedUrl !== 'string' || !feedUrl) return;

    const hintReportOnly = parsedData.webhint && parsedData.webhint.hintReportOnly !== false;

    // Only auto-hydrate the JSON if the user hasn't edited it yet.
    if (jsonState !== initialJson) return;

    // Avoid spamming events while JSON parse/state churns.
    if (lastRequestedUrlRef.current === feedUrl) return;
    lastRequestedUrlRef.current = feedUrl;

    bus.emit({
      channel: 'WEBHINT',
      type: 'LOAD_FEED',
      payload: { url: feedUrl, hintReportOnly },
      atMs: Date.now(),
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus, initialJson, jsonState, parsedData]);

  const canHydrateForUrl = useCallback(
    (url) => {
      if (typeof url !== 'string' || !url) return false;
      const current = parsedDataRef.current;
      const currentUrl = current && current.webhint && current.webhint.feedUrl;
      if (currentUrl !== url) return false;

      // Auto-hydrate only when untouched; allow hydration after explicit reload.
      if (jsonStateRef.current === initialJson) return true;
      return manualReloadUrlRef.current === url;
    },
    [initialJson],
  );

  const hydrateFromUpdated = useCallback(
    (payload) => {
      const url = payload && payload.url;
      if (!canHydrateForUrl(url)) return;

      const current = parsedDataRef.current;
      const counts = (payload && payload.counts) || {};

      const prevWebhint =
        current && current.webhint && typeof current.webhint === 'object' ? current.webhint : null;
      const nextWebhint = prevWebhint
        ? {
            ...prevWebhint,
            status: 'loaded',
            generatedAt: payload.generatedAt || null,
            totalEntries: typeof counts.totalEntries === 'number' ? counts.totalEntries : null,
            hintReportEntries:
              typeof counts.hintReportEntries === 'number' ? counts.hintReportEntries : null,
          }
        : {
            status: 'loaded',
            generatedAt: payload.generatedAt || null,
            totalEntries: typeof counts.totalEntries === 'number' ? counts.totalEntries : null,
            hintReportEntries:
              typeof counts.hintReportEntries === 'number' ? counts.hintReportEntries : null,
          };

      const next = {
        ...current,
        webhint: nextWebhint,
        languageDomTree: payload.tree || null,
      };

      manualReloadUrlRef.current = null;
      setJsonState(JSON.stringify(next, null, 2));
    },
    [canHydrateForUrl],
  );

  const hydrateFromError = useCallback(
    (payload) => {
      const url = payload && payload.url;
      if (!canHydrateForUrl(url)) return;

      const current = parsedDataRef.current;
      const prevWebhint =
        current && current.webhint && typeof current.webhint === 'object' ? current.webhint : null;
      const nextWebhint = prevWebhint
        ? { ...prevWebhint, status: 'error', error: String(payload.error || 'Unknown error') }
        : { status: 'error', error: String(payload.error || 'Unknown error') };

      const next = {
        ...current,
        webhint: nextWebhint,
      };

      manualReloadUrlRef.current = null;
      setJsonState(JSON.stringify(next, null, 2));
    },
    [canHydrateForUrl],
  );

  function requestReloadFeed() {
    const current = parsedDataRef.current;
    const feedUrl = current && current.webhint && current.webhint.feedUrl;
    if (typeof feedUrl !== 'string' || !feedUrl) return;

    const hintReportOnly = current.webhint && current.webhint.hintReportOnly !== false;
    manualReloadUrlRef.current = feedUrl;

    // Best-effort: reflect loading state in JSON (explicit user action).
    try {
      const prevWebhint =
        current && current.webhint && typeof current.webhint === 'object' ? current.webhint : null;
      const nextWebhint = prevWebhint
        ? { ...prevWebhint, status: 'loading', error: null }
        : { status: 'loading', error: null };
      setJsonState(JSON.stringify({ ...current, webhint: nextWebhint }, null, 2));
    } catch {
      // ignore
    }

    bus.emit({
      channel: 'WEBHINT',
      type: 'LOAD_FEED',
      payload: { url: feedUrl, hintReportOnly },
      atMs: Date.now(),
    });
  }

  useEffect(() => {
    const unsub = bus.subscribe('WEBHINT', (event) => {
      if (!event || typeof event.type !== 'string') return;
      const payload = event.payload || {};

      if (event.type === 'LDOM_UPDATED') {
        hydrateFromUpdated(payload);
        return;
      }

      if (event.type === 'LDOM_ERROR') {
        hydrateFromError(payload);
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [bus, hydrateFromError, hydrateFromUpdated]);

  const htmlLines = useMemo(() => {
    if (parsedData && parsedData.languageDomTree) {
      return languageDomTreeToPseudoHtmlLines(parsedData.languageDomTree, { maxLines: 180 });
    }
    return [];
  }, [parsedData]);

  // The Logic Layer (Mock representation of the event handlers)
  const handleInteraction = () => {
    if (parsedData.interactive) {
      alert(`Logic Layer Triggered: Processing "${parsedData.title}"`);
    }
  };

  const layers = [
    {
      id: 'json',
      label: 'Layer 1: Johnson (Data)',
      icon: Database,
      color: 'text-yellow-400',
      border: 'border-yellow-400',
    },
    {
      id: 'html',
      label: 'Layer 2: HTML (Structure)',
      icon: Code,
      color: 'text-orange-400',
      border: 'border-orange-400',
    },
    {
      id: 'css',
      label: 'Layer 3: CSS (Presentation)',
      icon: Eye,
      color: 'text-blue-400',
      border: 'border-blue-400',
    },
    {
      id: 'js',
      label: 'Layer 4: JS (Behavior)',
      icon: Terminal,
      color: 'text-purple-400',
      border: 'border-purple-400',
    },
    {
      id: 'composite',
      label: 'Top View (Result)',
      icon: Layers,
      color: 'text-green-400',
      border: 'border-green-400',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-mono">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-slate-700 pb-6 mb-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Layers className="w-8 h-8 text-emerald-400" />
              Turtle Embedding Architecture
            </h1>
            <button
              type="button"
              onClick={requestReloadFeed}
              disabled={
                !(
                  parsedData &&
                  parsedData.webhint &&
                  typeof parsedData.webhint.feedUrl === 'string' &&
                  parsedData.webhint.feedUrl
                )
              }
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reload feed
            </button>
          </div>
          <p className="text-slate-400 mt-2">
            Visualizing the "Universal Space Saving Method" by stacking language canvases.
          </p>
        </div>

        {/* Navigation / Layer Selection */}
        <div className="flex flex-wrap gap-2 mb-8">
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all duration-300 ${
                activeLayer === layer.id
                  ? `${layer.border} bg-slate-800 ${layer.color}`
                  : 'border-transparent hover:bg-slate-800 text-slate-500'
              }`}
            >
              <layer.icon size={18} />
              <span className="font-medium">{layer.label}</span>
            </button>
          ))}
        </div>

        {/* The Canvas Stack */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side: The "Agricultural" Code Layers */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl min-h-[500px] relative">
            <div className="absolute top-0 left-0 w-full h-8 bg-slate-900 flex items-center px-4 text-xs text-slate-500 border-b border-slate-800">
              <span className="mr-auto">syntax_canvas_v1.0</span>
              <span>{activeLayer.toUpperCase()} MODE</span>
            </div>

            <div className="p-6 pt-12 h-full overflow-auto">
              {/* LAYER 1: JSON */}
              {activeLayer === 'json' && (
                <div>
                  <div className="text-sm text-yellow-400 mb-2 font-bold">
                    // The Foundation: State &amp; Data
                  </div>
                  <textarea
                    value={jsonState}
                    onChange={(e) => setJsonState(e.target.value)}
                    className="w-full h-96 bg-transparent text-yellow-100 font-mono resize-none focus:outline-none"
                    spellCheck="false"
                  />
                  {error && <div className="text-red-500 mt-2">{error}</div>}
                </div>
              )}

              {/* LAYER 2: HTML */}
              {activeLayer === 'html' && (
                <div className="space-y-2">
                  <div className="text-sm text-orange-400 mb-2 font-bold">
                    // The Skeleton: Structure mapped to JSON
                  </div>

                  {htmlLines.length ? (
                    <pre className="text-slate-300 text-sm whitespace-pre-wrap">
                      {htmlLines.join('\n')}
                    </pre>
                  ) : (
                    <div className="text-slate-400">
                      &lt;<span className="text-pink-400">div</span>{' '}
                      <span className="text-emerald-400">className</span>="card"&gt;
                      <div className="pl-4">
                        &lt;<span className="text-pink-400">h2</span>{' '}
                        <span className="text-emerald-400">data-binding</span>="title"&gt;{' '}
                        <span className="text-white">{parsedData.title || '...'}</span> &lt;/
                        <span className="text-pink-400">h2</span>&gt;
                      </div>
                      <div className="pl-4">
                        &lt;<span className="text-pink-400">p</span>{' '}
                        <span className="text-emerald-400">data-binding</span>="description"&gt;{' '}
                        <span className="text-white">{parsedData.description || '...'}</span> &lt;/
                        <span className="text-pink-400">p</span>&gt;
                      </div>
                      <div className="pl-4">
                        &lt;<span className="text-pink-400">button</span>{' '}
                        <span className="text-emerald-400">onClick</span>="handleInteraction"&gt;{' '}
                        <span className="text-white">Activate</span> &lt;/
                        <span className="text-pink-400">button</span>&gt;
                      </div>
                      &lt;/<span className="text-pink-400">div</span>&gt;
                    </div>
                  )}
                </div>
              )}

              {/* LAYER 3: CSS */}
              {activeLayer === 'css' && (
                <div className="space-y-2 text-blue-100">
                  <div className="text-sm text-blue-400 mb-2 font-bold">
                    // The Skin: Styling mapped to Structure
                  </div>
                  <div>
                    <span className="text-yellow-400">.card</span> {'{'}
                  </div>
                  <div className="pl-4">
                    background: <span className="text-emerald-400">slate-800</span>;
                  </div>
                  <div className="pl-4">
                    border-color:{' '}
                    <span className="text-emerald-400">{parsedData.accentColor}-500</span>;
                  </div>
                  <div className="pl-4">
                    padding: <span className="text-purple-400">2rem</span>;
                  </div>
                  <div>{'}'}</div>
                  <br />
                  <div>
                    <span className="text-yellow-400">.card h2</span> {'{'}
                  </div>
                  <div className="pl-4">
                    font-size: <span className="text-purple-400">1.5rem</span>;
                  </div>
                  <div className="pl-4">
                    color: <span className="text-emerald-400">white</span>;
                  </div>
                  <div>{'}'}</div>
                </div>
              )}

              {/* LAYER 4: JS */}
              {activeLayer === 'js' && (
                <div className="space-y-2 text-purple-100">
                  <div className="text-sm text-purple-400 mb-2 font-bold">
                    // The Muscle: Logic mapped to State
                  </div>
                  <div>
                    <span className="text-pink-400">const</span>{' '}
                    <span className="text-blue-300">component</span> ={' '}
                    <span className="text-yellow-300">new</span>{' '}
                    <span className="text-green-300">TurtleEmbed</span>();
                  </div>
                  <br />
                  <div>
                    <span className="text-blue-300">component</span>.
                    <span className="text-yellow-300">onMount</span>(() =&gt; {'{'})
                  </div>
                  <div className="pl-4">
                    <span className="text-slate-400">// Listening to Johnson Layer changes</span>
                  </div>
                  <div className="pl-4">
                    subscribeToState(<span className="text-orange-300">'{parsedData.title}'</span>);
                  </div>
                  <div>{'}'});</div>
                  <br />
                  <div>
                    <span className="text-pink-400">function</span>{' '}
                    <span className="text-yellow-300">handleInteraction</span>() {'{'}
                  </div>
                  <div className="pl-4">
                    <span className="text-pink-400">if</span> (state.interactive ==={' '}
                    <span className="text-orange-300">{String(parsedData.interactive)}</span>) {'{'}
                  </div>
                  <div className="pl-8">triggerAnimation();</div>
                  <div className="pl-4">{'}'}</div>
                  <div>{'}'}</div>
                </div>
              )}

              {/* COMPOSITE VIEW EXPLANATION */}
              {activeLayer === 'composite' && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-slate-500">
                  <Activity className="w-16 h-16 opacity-20" />
                  <p>Viewing all layers simultaneously.</p>
                  <p className="text-sm max-w-xs">
                    The Browser Engine compiles the JSON, HTML, CSS, and JS into the visual result
                    on the right.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: The Visual Result (The "Deciphered" Output) */}
          <div className="bg-slate-800 rounded-xl p-8 flex items-center justify-center border border-slate-700 shadow-inner relative">
            <div className="absolute top-4 right-4 text-xs font-bold text-slate-600 uppercase tracking-widest">
              Rendered Output
            </div>

            {/* The Actual Component being rendered based on the layers */}
            <div
              className={`
                relative w-full max-w-sm bg-slate-900 rounded-2xl p-6 border-2 shadow-2xl transition-all duration-500
                ${parsedData.accentColor === 'emerald' ? 'border-emerald-500 shadow-emerald-900/20' : ''}
                ${parsedData.accentColor === 'blue' ? 'border-blue-500 shadow-blue-900/20' : ''}
                ${parsedData.accentColor === 'red' ? 'border-red-500 shadow-red-900/20' : ''}
                ${parsedData.accentColor === 'purple' ? 'border-purple-500 shadow-purple-900/20' : ''}
              `}
            >
              <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-xs text-slate-400 border border-slate-700 rounded-full">
                Layer 4 Complete
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {parsedData.title || 'Untitled'}
              </h2>
              <p className="text-slate-400 mb-6 leading-relaxed">
                {parsedData.description || 'No description provided.'}
              </p>

              <button
                onClick={handleInteraction}
                disabled={!parsedData.interactive}
                className={`
                  w-full py-3 rounded-lg font-semibold transition-all transform active:scale-95
                  ${
                    parsedData.interactive
                      ? 'bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }
                `}
              >
                {parsedData.interactive ? 'Test Interaction' : 'Interaction Disabled'}
              </button>

              {/* Visualizing the "Turtles" underneath */}
              <div className="mt-8 pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Stack Depth: 4</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" title="JSON"></div>
                    <div className="w-2 h-2 rounded-full bg-orange-500" title="HTML"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500" title="CSS"></div>
                    <div className="w-2 h-2 rounded-full bg-purple-500" title="JS"></div>
                  </div>
                </div>

                {parsedData.webhint && (
                  <div className="mt-3 text-[11px] text-slate-500">
                    Webhint feed: {parsedData.webhint.status}
                    {typeof parsedData.webhint.hintReportEntries === 'number'
                      ? ` • hint-report entries: ${parsedData.webhint.hintReportEntries}`
                      : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Legend / Instructions */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h3 className="font-bold text-slate-300 mb-2">How to use the Agriculture Method:</h3>
          <ul className="list-disc list-inside space-y-1 text-slate-400 text-sm">
            <li>
              Click <strong>Layer 1 (Johnson)</strong> to see the raw embedding. Try changing the{' '}
              <code className="bg-slate-900 px-1 rounded">title</code> or{' '}
              <code className="bg-slate-900 px-1 rounded">accentColor</code> (try "red", "blue",
              "purple") to see it ripple up the stack.
            </li>
            <li>
              Click <strong>Layer 2 (HTML)</strong> to see how tags wrap the data. If{' '}
              <code className="bg-slate-900 px-1 rounded">languageDomTree</code> exists, it renders
              a pseudo-HTML tree.
            </li>
            <li>
              Click <strong>Layer 3 (CSS)</strong> to see how styling targets the tags.
            </li>
            <li>
              The <strong>Result</strong> is the deciphered union of all layers.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TurtleStack;
