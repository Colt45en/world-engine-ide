/* eslint-disable react/prop-types */
import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Binary,
  CheckCircle,
  ChevronRight,
  Code,
  Database,
  Folder,
  Globe,
  Hash,
  Layers,
  Server,
  Settings,
  ShieldAlert,
  Terminal as TerminalIcon,
  ToggleLeft,
  ToggleRight,
  Type,
  List,
  X,
  Zap,
  Search,
} from 'lucide-react';

/**
 * World Engine Studio — Dashboard
 *
 * Notes:
 * - This is a UI-only dashboard used inside the existing `/dashboard` route.
 * - It uses localStorage for a lightweight “hive storage” mock.
 */

const THEME = {
  bg: 'bg-slate-950',
  panel: 'bg-slate-900/90',
  border: 'border-slate-800',
  accent: 'text-cyan-400',
  accentBorder: 'border-cyan-500',
  accentBg: 'bg-cyan-500',
  text: 'text-slate-300',
  textDim: 'text-slate-500',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-rose-500',
};

const generateId = () => Math.random().toString(36).substr(2, 5).toUpperCase();

const MockBackendService = {
  pushData: async (dataPayload) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const existingData = JSON.parse(localStorage.getItem('world_engine_logs') || '[]');

        const extendedRecord = {
          _id: `LOG_${Date.now()}_${generateId()}`,
          _timestamp: new Date().toISOString(),
          _server_node: 'US-EAST-1A',
          _status: 'PROCESSED',
          payload: dataPayload,
          meta: {
            inputLength: dataPayload.input?.length || 0,
            outputLength: dataPayload.output?.length || 0,
            toolUsed: dataPayload.tool,
          },
        };

        const newData = [extendedRecord, ...existingData].slice(0, 50);
        localStorage.setItem('world_engine_logs', JSON.stringify(newData));
        resolve(extendedRecord);
      }, 600);
    });
  },

  fetchLogs: () => {
    return JSON.parse(localStorage.getItem('world_engine_logs') || '[]');
  },
};

const NodeDetails = ({ selectedNode, onRunScript }) => {
  if (!selectedNode)
    return (
      <div className="p-4 text-xs text-slate-500 text-center italic">Select a node to inspect</div>
    );

  return (
    <div className="p-4 space-y-4 font-mono text-xs">
      <div className="space-y-1">
        <div className="text-slate-500 uppercase text-[10px]">Entity ID</div>
        <div className="text-xl text-cyan-400 font-bold">
          {selectedNode.label || selectedNode.id}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-slate-500 uppercase text-[10px]">Status</div>
        <div
          className={`flex items-center gap-2 ${selectedNode.type === 'infected' ? 'text-rose-400' : 'text-emerald-400'}`}
        >
          {selectedNode.type === 'infected' ? <ShieldAlert size={14} /> : <CheckCircle size={14} />}
          {selectedNode.type === 'infected' ? 'CORRUPTED' : 'OPERATIONAL'}
        </div>
      </div>
      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={() => onRunScript('ping', selectedNode.id)}
          className="w-full mb-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded transition flex items-center justify-center gap-2"
        >
          <Activity size={12} /> Ping Node
        </button>
        {selectedNode.type === 'infected' && (
          <button
            onClick={() => onRunScript('purge', selectedNode.id)}
            className="w-full bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900 py-1.5 rounded transition flex items-center justify-center gap-2"
          >
            <AlertTriangle size={12} /> Purge Protocol
          </button>
        )}
      </div>
    </div>
  );
};

function htmlEncodeOrDecode(input) {
  if (input.includes('&') && input.includes(';')) {
    const doc = new DOMParser().parseFromString(input, 'text/html');
    return doc.documentElement.textContent;
  }

  return input.replaceAll(/[\u00A0-\u9999<>&]/g, (ch) => {
    const cp = ch.codePointAt(0);
    return typeof cp === 'number' ? `&#${cp};` : ch;
  });
}

function hexEncodeOrDecode(input) {
  const isHex = /^[0-9A-Fa-f]+$/.test(input);
  if (isHex && input.length % 2 === 0) {
    const chunks = input.match(/.{1,2}/g) || [];
    return chunks.map((byte) => String.fromCodePoint(Number.parseInt(byte, 16))).join('');
  }

  return input
    .split('')
    .map((c) => {
      const cp = c.codePointAt(0);
      return (typeof cp === 'number' ? cp : 0).toString(16).padStart(2, '0');
    })
    .join('');
}

function tokenize(input, delim = ' ') {
  return JSON.stringify(input.split(delim), null, 2);
}

function base64EncodeUtf8(input) {
  return btoa(unescape(encodeURIComponent(input)));
}

function base64DecodeUtf8(input) {
  return decodeURIComponent(escape(atob(input)));
}

function classForLogType(type) {
  if (type === 'error') return 'text-rose-400';
  if (type === 'success') return 'text-emerald-400';
  if (type === 'system') return 'text-cyan-400';
  return 'text-slate-300';
}

function countNodesByType(nodes, type) {
  let count = 0;
  for (const n of nodes) if (n.type === type) count += 1;
  return count;
}

function resizeCanvasToParent(canvas) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const { clientWidth, clientHeight } = parent;
  if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
    canvas.width = clientWidth;
    canvas.height = clientHeight;
  }
}

function drawGrid(ctx, canvas, timeSeconds) {
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
  ctx.lineWidth = 1;
  const gridSize = 50;
  const offsetX = (timeSeconds * 10) % gridSize;
  const offsetY = (timeSeconds * 10) % gridSize;

  for (let x = -gridSize; x < canvas.width + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x + offsetX, 0);
    ctx.lineTo(x + offsetX, canvas.height);
    ctx.stroke();
  }
  for (let y = -gridSize; y < canvas.height + gridSize; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y + offsetY);
    ctx.lineTo(canvas.width, y + offsetY);
    ctx.stroke();
  }
}

function drawRipples(ctx, ripples) {
  const next = [];
  for (const ripple of ripples) {
    const r = { ...ripple, r: ripple.r + 15, alpha: ripple.alpha - 0.02 };
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(6, 182, 212, ${r.alpha})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    if (r.alpha > 0) next.push(r);
  }
  return next;
}

function updateNodePosition(node, canvas) {
  node.x += node.vx;
  node.y += node.vy;

  if (node.x < 20 || node.x > canvas.width - 20) node.vx *= -1;
  if (node.y < 20 || node.y > canvas.height - 20) node.vy *= -1;
}

function drawConnection(ctx, node, target) {
  ctx.beginPath();
  const grad = ctx.createLinearGradient(node.x, node.y, target.x, target.y);
  const isInf = node.type === 'infected' || target.type === 'infected';
  const color = isInf ? '225, 29, 72' : '6, 182, 212';

  grad.addColorStop(0, `rgba(${color}, 0.1)`);
  grad.addColorStop(0.5, `rgba(${color}, 0.3)`);
  grad.addColorStop(1, `rgba(${color}, 0.1)`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.moveTo(node.x, node.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
}

function applyNodeStyle(ctx, node, timeSeconds) {
  if (node.type === 'core') {
    ctx.fillStyle = '#06b6d4';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 15;
    return;
  }

  if (node.type === 'infected') {
    ctx.fillStyle = '#e11d48';
    ctx.shadowColor = '#e11d48';
    ctx.shadowBlur = 15 + Math.sin(timeSeconds * 10) * 5;
    return;
  }

  ctx.fillStyle = node.selected ? '#f8fafc' : '#475569';
  ctx.shadowBlur = node.selected ? 10 : 0;
  ctx.shadowColor = '#fff';
}

function drawNode(ctx, node, timeSeconds) {
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
  applyNodeStyle(ctx, node, timeSeconds);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawNodeLabel(ctx, node) {
  if (!node.selected && node.type !== 'core') return;
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText(node.label || node.id, node.x + 12, node.y + 3);
}

function maybeTriggerAnomaly(nodesSnapshot, setNodes, addLog) {
  if (Math.random() <= 0.98) return false;
  if (!nodesSnapshot.length) return false;

  const candidate = nodesSnapshot[Math.floor(Math.random() * nodesSnapshot.length)];
  if (!candidate || candidate.type === 'core' || candidate.type === 'infected') return false;

  addLog(`WARNING: Anomalous signal detected in Sector ${candidate.id}`, 'error');
  setNodes((prev) => {
    const next = prev.slice();
    let idx = -1;
    for (let i = 0; i < next.length; i += 1) {
      if (next[i].id === candidate.id) {
        idx = i;
        break;
      }
    }
    if (idx >= 0 && next[idx].type !== 'core' && next[idx].type !== 'infected') {
      next[idx] = { ...next[idx], type: 'infected' };
    }
    return next;
  });

  return true;
}

const TopBar = ({ systemIntegrity, activeThreads }) => (
  <div
    className={`h-12 border-b ${THEME.border} ${THEME.bg} flex items-center px-4 justify-between select-none z-50 relative flex-shrink-0`}
  >
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-wider">
        <Globe size={18} />
        <span className="hidden sm:inline">WORLD ENGINE STUDIO</span>
        <span className="sm:hidden">W.E.S.</span>
      </div>
      <div className="hidden lg:flex items-center bg-slate-800 rounded px-3 py-1 text-xs text-slate-400 border border-slate-700 w-64 font-mono">
        <span className="text-emerald-500 mr-2">root@local:</span>
        <span className="text-slate-300">~/simulation/instance_01</span>
      </div>
    </div>

    <div className="flex items-center gap-4">
      <div className="hidden md:flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-1">
          <span className={systemIntegrity > 50 ? 'text-emerald-400' : 'text-rose-500'}>
            INTEGRITY: {systemIntegrity.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span>THREADS: {activeThreads}</span>
        </div>
      </div>
      <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block"></div>
      <button className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition">
        <Settings size={16} />
      </button>
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 ml-2 border-2 border-slate-800 shadow-lg relative">
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
      </div>
    </div>
  </div>
);

const LeftSidebar = ({ className = '', selectedNode, onRunScript, addLog }) => {
  const [activeSection, setActiveSection] = useState('inspector');

  const [activeTool, setActiveTool] = useState('html');
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState('');
  const [extraParam, setExtraParam] = useState('');
  const [extraParam2, setExtraParam2] = useState('');

  const [autoProcess, setAutoProcess] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [dbLogs, setDbLogs] = useState([]);

  useEffect(() => {
    if (activeSection === 'database') {
      setDbLogs(MockBackendService.fetchLogs());
    }
  }, [activeSection]);

  const runTool = () => {
    try {
      let res = '';
      if (activeTool === 'html') res = htmlEncodeOrDecode(toolInput);
      else if (activeTool === 'hex') res = hexEncodeOrDecode(toolInput);
      else if (activeTool === 'fix') res = `${extraParam}${toolInput}${extraParam2}`;
      else if (activeTool === 'token') res = tokenize(toolInput, extraParam);
      else if (activeTool === 'b64enc') res = base64EncodeUtf8(toolInput);
      else if (activeTool === 'b64dec') res = base64DecodeUtf8(toolInput);

      setToolOutput(res);
      return res;
    } catch (e) {
      const res = `Error: ${e?.message || 'Processing failed'}`;
      setToolOutput(res);
      return res;
    }
  };

  useEffect(() => {
    if (autoProcess) {
      runTool();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolInput, activeTool, extraParam, extraParam2, autoProcess]);

  const handlePushToBackend = async () => {
    if (!toolOutput) return;
    setIsPushing(true);

    const payload = {
      tool: activeTool,
      input: toolInput,
      output: toolOutput,
      params: { extraParam, extraParam2 },
    };

    try {
      await MockBackendService.pushData(payload);
      addLog('Data committed to Hive Storage. Node: US-EAST-1A', 'success');
    } catch {
      addLog('Storage commitment failed.', 'error');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div
      className={`flex-shrink-0 border-r ${THEME.border} ${THEME.bg} flex flex-col overflow-hidden ${className}`}
    >
      <div className="p-2 border-b border-slate-800">
        <div className="flex gap-1 bg-slate-900 p-1 rounded border border-slate-800">
          <button
            onClick={() => setActiveSection('inspector')}
            className={`flex-1 py-1 text-[10px] rounded font-medium text-center transition ${
              activeSection === 'inspector'
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Inspect
          </button>
          <button
            onClick={() => setActiveSection('scripts')}
            className={`flex-1 py-1 text-[10px] rounded font-medium text-center transition ${
              activeSection === 'scripts'
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Scripts
          </button>
          <button
            onClick={() => setActiveSection('utils')}
            className={`flex-1 py-1 text-[10px] rounded font-medium text-center transition ${
              activeSection === 'utils'
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Utils
          </button>
          <button
            onClick={() => setActiveSection('database')}
            className={`flex-1 py-1 text-[10px] rounded font-medium text-center transition ${
              activeSection === 'database'
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            DB
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeSection === 'inspector' && (
          <NodeDetails selectedNode={selectedNode} onRunScript={onRunScript} />
        )}

        {activeSection === 'scripts' && (
          <div className="p-2 space-y-1">
            <div className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
              Available Protocols
            </div>
            {[
              { id: 'scan', label: 'Deep System Scan', icon: Search, color: 'text-blue-400' },
              { id: 'optimize', label: 'Optimize Routes', icon: Zap, color: 'text-yellow-400' },
              {
                id: 'firewall',
                label: 'Reinforce Firewall',
                icon: Layers,
                color: 'text-purple-400',
              },
            ].map((script) => (
              <button
                key={script.id}
                onClick={() => onRunScript(script.id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded transition group text-left"
              >
                <script.icon size={14} className={script.color} />
                <span>{script.label}</span>
                <ChevronRight
                  size={12}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition"
                />
              </button>
            ))}
          </div>
        )}

        {activeSection === 'database' && (
          <div className="p-0">
            <div className="p-3 border-b border-slate-800 bg-slate-900/50 sticky top-0 backdrop-blur z-10">
              <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                <Database size={14} /> EXTENDED LOG STORAGE
              </h3>
            </div>
            <div className="divide-y divide-slate-800">
              {dbLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-xs italic">
                  No records in local hive.
                </div>
              ) : (
                dbLogs.map((log) => (
                  <div
                    key={log._id}
                    className="p-3 hover:bg-slate-900 transition group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] text-cyan-500 font-mono">{log._id}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log._timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-300 border border-slate-700">
                        {String(log?.payload?.tool || '').toUpperCase()}
                      </span>
                      <span className="text-[10px] bg-emerald-900/30 px-1 rounded text-emerald-400 border border-emerald-900/50">
                        LEN: {log?.meta?.outputLength}
                      </span>
                    </div>
                    <div className="bg-black/40 rounded p-2 text-[10px] font-mono text-slate-400 break-all border border-slate-800 group-hover:border-slate-600 transition">
                      {String(log?.payload?.output || '').substring(0, 100)}
                      {String(log?.payload?.output || '').length > 100 && '...'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeSection === 'utils' && (
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-4 gap-1 mb-2">
              <button
                onClick={() => {
                  setActiveTool('html');
                  setToolOutput('');
                }}
                className={`p-1.5 rounded flex justify-center ${
                  activeTool === 'html'
                    ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-800'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                title="HTML Encoder"
              >
                <Code size={14} />
              </button>
              <button
                onClick={() => {
                  setActiveTool('hex');
                  setToolOutput('');
                }}
                className={`p-1.5 rounded flex justify-center ${
                  activeTool === 'hex'
                    ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-800'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                title="Hex Coder"
              >
                <Hash size={14} />
              </button>
              <button
                onClick={() => {
                  setActiveTool('fix');
                  setToolOutput('');
                }}
                className={`p-1.5 rounded flex justify-center ${
                  activeTool === 'fix'
                    ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-800'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                title="Prefix/Suffix"
              >
                <Type size={14} />
              </button>
              <button
                onClick={() => {
                  setActiveTool('token');
                  setToolOutput('');
                }}
                className={`p-1.5 rounded flex justify-center ${
                  activeTool === 'token'
                    ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-800'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                title="Tokenizer"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => {
                  setActiveTool('b64enc');
                  setToolOutput('');
                }}
                className={`p-1.5 rounded flex justify-center ${
                  activeTool === 'b64enc'
                    ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-800'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                title="Base64 Encode"
              >
                <Binary size={14} />
              </button>
              <button
                onClick={() => {
                  setActiveTool('b64dec');
                  setToolOutput('');
                }}
                className={`p-1.5 rounded flex justify-center ${
                  activeTool === 'b64dec'
                    ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-800'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                title="Base64 Decode"
              >
                <Binary size={14} className="rotate-180" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="text-[10px] uppercase text-slate-500 font-bold">
                  {activeTool === 'html' && 'HTML Encode/Decode'}
                  {activeTool === 'hex' && 'Hexual Coder'}
                  {activeTool === 'fix' && 'Prefix / Suffix'}
                  {activeTool === 'token' && 'Tokenizer Parser'}
                  {activeTool === 'b64enc' && 'Base64 Encoder'}
                  {activeTool === 'b64dec' && 'Base64 Decoder'}
                </div>
                <button
                  onClick={() => setAutoProcess(!autoProcess)}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded transition ${
                    autoProcess
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {autoProcess ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  AUTO
                </button>
              </div>

              {activeTool === 'fix' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Prefix"
                    value={extraParam}
                    onChange={(e) => setExtraParam(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-cyan-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Suffix"
                    value={extraParam2}
                    onChange={(e) => setExtraParam2(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-cyan-500 outline-none"
                  />
                </div>
              )}
              {activeTool === 'token' && (
                <input
                  type="text"
                  placeholder="Delimiter (default: space)"
                  value={extraParam}
                  onChange={(e) => setExtraParam(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-cyan-500 outline-none"
                />
              )}

              <textarea
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                placeholder="Input data..."
                className="w-full h-24 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 font-mono focus:border-cyan-500 outline-none resize-none"
              />

              <div className="flex gap-2">
                {!autoProcess && (
                  <button
                    onClick={runTool}
                    className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded transition"
                  >
                    PROCESS
                  </button>
                )}
                <button
                  onClick={handlePushToBackend}
                  disabled={isPushing || !toolOutput}
                  className={`flex-1 py-1 flex items-center justify-center gap-2 text-xs font-bold rounded transition ${
                    isPushing
                      ? 'bg-cyan-800 cursor-wait'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20'
                  }`}
                >
                  {isPushing ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Server size={12} />
                  )}
                  {isPushing ? 'PUSHING...' : 'COMMIT DB'}
                </button>
              </div>

              <div className="text-[10px] uppercase text-slate-500 font-bold mt-2">
                Output Result
              </div>
              <div className="w-full h-24 bg-black/40 border border-slate-800 rounded p-2 text-xs text-emerald-400 font-mono overflow-y-auto break-all">
                {toolOutput || '// Waiting for input...'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
        <div>MEM_ALLOC: 0x4F2A91</div>
        <div>SEC_LEVEL: ALPHA</div>
      </div>
    </div>
  );
};

const NodeGraph = ({ className = '', nodes, onNodeClick, activeEffect }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let effectRipples = [];

    if (activeEffect) {
      effectRipples.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        r: 0,
        maxR: canvas.width,
        alpha: 1,
      });
    }

    const renderFrame = () => {
      resizeCanvasToParent(canvas);

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const timeSeconds = Date.now() / 1000;
      drawGrid(ctx, canvas, timeSeconds);
      effectRipples = drawRipples(ctx, effectRipples);

      const nodesById = new Map();
      for (const n of nodes) nodesById.set(n.id, n);

      for (const node of nodes) {
        updateNodePosition(node, canvas);
        for (const connId of node.connections) {
          const target = nodesById.get(connId);
          if (target) drawConnection(ctx, node, target);
        }
        drawNode(ctx, node, timeSeconds);
        drawNodeLabel(ctx, node);
      }

      animationFrameId = requestAnimationFrame(renderFrame);
    };

    renderFrame();
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes, activeEffect]);

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let clickedNode = null;
    for (const node of nodes) {
      const dist = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
      if (dist < node.radius + 10) {
        clickedNode = node;
        break;
      }
    }

    onNodeClick(clickedNode || null);
  };

  return (
    <div className={`relative flex-1 overflow-hidden bg-slate-950 ${className}`}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="absolute inset-0 w-full h-full block cursor-crosshair"
      />

      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-xl w-56">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">
              System Status
            </span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse delay-75"></div>
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">NODES</span>
              <span className="text-white">{nodes.length}</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">CORRUPTED</span>
              <span className="text-rose-500 font-bold">{countNodesByType(nodes, 'infected')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full px-4 py-1.5 flex gap-4 shadow-2xl z-10">
        <span className="text-[10px] font-mono text-slate-500 flex items-center">
          MODE: <span className="text-cyan-400 ml-1 font-bold">INTERACTIVE_SHELL</span>
        </span>
      </div>
    </div>
  );
};

const Terminal = ({ logs, onCommand, isOpen, toggleOpen }) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onCommand(input);
    setInput('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="absolute bottom-0 right-8 bg-slate-800 border-t border-x border-slate-600 rounded-t-lg px-4 py-2 text-xs font-mono text-slate-300 flex items-center gap-2 hover:bg-slate-700 transition"
      >
        <TerminalIcon size={14} /> TERMINAL
      </button>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 h-48 bg-slate-900/95 backdrop-blur border-t border-slate-700 flex flex-col font-mono text-xs z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between px-4 py-1 bg-slate-800 border-b border-slate-700 select-none">
        <span className="text-slate-400 flex items-center gap-2">
          <TerminalIcon size={12} /> TERMINAL ACCESS
        </span>
        <button onClick={toggleOpen} className="hover:text-white text-slate-500">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono">
        {logs.map((log) => (
          <div key={log.id} className={classForLogType(log.type)}>
            <span className="opacity-50 mr-2">
              [{new Date().toLocaleTimeString().split(' ')[0]}]
            </span>
            {log.content}
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-2 border-t border-slate-800 bg-slate-950 flex items-center gap-2"
      >
        <span className="text-emerald-500 font-bold">{'>'}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-slate-100 font-mono"
          placeholder="Enter command (try 'help', 'scan', 'purge')"
        />
      </form>
    </div>
  );
};

const ChartLine = ({ data, color = '#06b6d4' }) => {
  const max = 100;
  const min = 0;
  const range = max - min;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((val - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="relative w-full h-12 overflow-hidden">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <path d={`M 0,100 L ${points} L 100,100 Z`} fill={color} fillOpacity="0.1" />
        <path
          d={`M ${points}`}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};

const PerformancePanel = ({ className = '', metrics }) => {
  return (
    <div className={`border-l ${THEME.border} ${THEME.bg} flex flex-col ${className}`}>
      <div className="p-3 border-b border-slate-800 bg-slate-900">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <Activity size={14} className="text-cyan-400" /> Live Metrics
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="mb-6">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">SYSTEM INTEGRITY</span>
            <span className={metrics.integrity > 50 ? 'text-emerald-400' : 'text-rose-500'}>
              {metrics.integrity.toFixed(1)}%
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded p-1">
            <ChartLine
              data={metrics.history.integrity}
              color={metrics.integrity > 50 ? '#10b981' : '#f43f5e'}
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">CPU LOAD</span>
            <span className="text-purple-400">{metrics.load.toFixed(1)}%</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded p-1">
            <ChartLine data={metrics.history.load} color="#a855f7" />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">System Events</h4>
          <div className="space-y-1.5">
            {metrics.events
              .slice(-5)
              .reverse()
              .map((event, i) => (
                <div
                  key={`${event.time}-${event.msg}-${i}`}
                  className="text-[10px] font-mono border-l-2 border-slate-700 pl-2 py-0.5"
                >
                  <span className="text-slate-500 block">{event.time}</span>
                  <span className="text-slate-300">{event.msg}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MobileNav = ({ activeTab, setActiveTab }) => (
  <div className="md:hidden h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around z-50 flex-shrink-0 safe-area-bottom">
    <button
      onClick={() => setActiveTab('resources')}
      className={`flex flex-col items-center p-2 w-full transition-colors ${
        activeTab === 'resources' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <Folder size={20} />
      <span className="text-[10px] mt-1 font-medium">Tools</span>
    </button>
    <button
      onClick={() => setActiveTab('graph')}
      className={`flex flex-col items-center p-2 w-full transition-colors ${
        activeTab === 'graph' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <Globe size={20} />
      <span className="text-[10px] mt-1 font-medium">Grid</span>
    </button>
    <button
      onClick={() => setActiveTab('monitor')}
      className={`flex flex-col items-center p-2 w-full transition-colors ${
        activeTab === 'monitor' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <Activity size={20} />
      <span className="text-[10px] mt-1 font-medium">Stats</span>
    </button>
  </div>
);

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function safeLower(v) {
  return typeof v === 'string' ? v.toLowerCase() : '';
}

function buildCommandHandlers(ctx) {
  const {
    addLog,
    setLogs,
    setNodes,
    setActiveEffect,
    setMetrics,
    metricsRef,
    nodesRef,
    selectedNodeIdRef,
  } = ctx;

  return {
    help() {
      addLog('AVAILABLE COMMANDS:', 'system');
      addLog('  scan       - Reveal hidden nodes', 'info');
      addLog('  status     - Show system details', 'info');
      addLog('  connect <id> - Link to a node', 'info');
      addLog('  purge <id>   - Cleanse a corrupted node', 'info');
      addLog('  clear      - Clear terminal', 'info');
    },

    clear() {
      setLogs([]);
    },

    status() {
      const m = metricsRef.current;
      const nodes = nodesRef.current;
      const hasInfected = nodes.some((n) => n.type === 'infected');
      addLog(
        `System Integrity: ${m.integrity.toFixed(2)}%`,
        m.integrity > 80 ? 'success' : 'error',
      );
      addLog(`Active Nodes: ${nodes.length}`, 'info');
      addLog(`Threat Level: ${hasInfected ? 'CRITICAL' : 'MINIMAL'}`, 'info');
    },

    scan() {
      const nodes = nodesRef.current;
      setActiveEffect(true);
      setTimeout(() => setActiveEffect(false), 2000);
      addLog('Initiating Deep Sector Scan...', 'system');

      setTimeout(() => {
        const newId = generateId();
        const coreId = nodes[0] ? nodes[0].id : null;
        const newNode = {
          id: newId,
          x: Math.random() * 800,
          y: Math.random() * 600,
          radius: Math.random() * 6 + 4,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          connections: coreId ? [coreId] : [],
          type: Math.random() > 0.8 ? 'infected' : 'leaf',
          selected: false,
        };
        setNodes((prev) => [...prev, newNode]);
        addLog(
          `Scan Complete. Found entity: ${newId}`,
          newNode.type === 'infected' ? 'error' : 'success',
        );
      }, 1500);
    },

    purge(_, args) {
      const nodes = nodesRef.current;
      const targetId = args[0] || selectedNodeIdRef.current;
      if (!targetId) {
        addLog('Error: No target specified. Select node or type ID.', 'error');
        return;
      }
      const targetNode = nodes.find((n) => safeLower(n.id) === safeLower(targetId));
      if (!targetNode) {
        addLog(`Error: Node ${targetId} not found.`, 'error');
        return;
      }
      if (targetNode.type !== 'infected') {
        addLog(`Node ${targetNode.id} is stable. No action needed.`, 'info');
        return;
      }

      addLog(`Purging corruption from ${targetNode.id}...`, 'warning');
      setTimeout(() => {
        setNodes((prev) => {
          const next = prev.slice();
          let idx = -1;
          for (let i = 0; i < next.length; i += 1) {
            if (next[i].id === targetNode.id) {
              idx = i;
              break;
            }
          }
          if (idx >= 0) next[idx] = { ...next[idx], type: 'leaf' };
          return next;
        });
        addLog(`Node ${targetNode.id} restored.`, 'success');
        setMetrics((prev) => ({ ...prev, integrity: Math.min(100, prev.integrity + 15) }));
      }, 1000);
    },

    ping(_, args) {
      const pingId = args[0] || selectedNodeIdRef.current;
      if (!pingId) {
        addLog('Target required.', 'error');
        return;
      }
      addLog(`Pinging ${pingId}...`, 'info');
      setTimeout(() => addLog(`Response from ${pingId}: 14ms (Healthy)`, 'success'), 500);
    },
  };
}

const Dashboard = () => {
  const [mobileTab, setMobileTab] = useState('graph');
  const [terminalOpen, setTerminalOpen] = useState(true);

  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const logSeqRef = useRef(1);
  const [logs, setLogs] = useState([
    { id: 'log-0', type: 'system', content: 'System initialized. Waiting for input...' },
  ]);
  const [activeEffect, setActiveEffect] = useState(false);

  const [metrics, setMetrics] = useState({
    integrity: 100,
    load: 12,
    history: { integrity: new Array(40).fill(100), load: new Array(40).fill(10) },
    events: [],
  });

  const metricsRef = useRef(metrics);
  const nodesRef = useRef(nodes);
  const selectedNodeIdRef = useRef(selectedNodeId);

  const addLog = (content, type = 'info') => {
    const nextId = `log-${logSeqRef.current++}`;
    setLogs((prev) => [...prev, { id: nextId, content, type }]);
  };

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    const initialNodes = Array.from({ length: 15 }).map((_, i) => ({
      id: generateId(),
      x: Math.random() * 800,
      y: Math.random() * 600,
      radius: i === 0 ? 15 : Math.random() * 6 + 4,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      connections: [],
      type: i === 0 ? 'core' : 'leaf',
      selected: false,
    }));

    initialNodes.forEach((node, i) => {
      if (i > 0 && Math.random() > 0.5) node.connections.push(initialNodes[0].id);
    });

    setNodes(initialNodes);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const didAnomaly = maybeTriggerAnomaly(nodesRef.current, setNodes, addLog);
      setMetrics((prev) => {
        const infectedCount = countNodesByType(nodesRef.current, 'infected');
        const corruptionDrag = infectedCount * 1.5;
        const newIntegrity = clamp(prev.integrity - corruptionDrag * 0.1 + 0.05, 0, 100);

        const targetLoad = 10 + nodesRef.current.length * 0.5 + (activeEffect ? 30 : 0);
        const newLoad = prev.load + (targetLoad - prev.load) * 0.1;

        const newEvents = didAnomaly
          ? [...prev.events, { time: new Date().toLocaleTimeString(), msg: 'Anomaly Detected' }]
          : prev.events;

        return {
          integrity: newIntegrity,
          load: newLoad,
          history: {
            integrity: [...prev.history.integrity.slice(1), newIntegrity],
            load: [...prev.history.load.slice(1), newLoad],
          },
          events: newEvents,
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeEffect]);

  const handleNodeClick = (node) => {
    setSelectedNodeId(node ? node.id : null);
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        selected: node ? n.id === node.id : false,
      })),
    );
  };

  const cmdHandlers = buildCommandHandlers({
    addLog,
    setLogs,
    setNodes,
    setActiveEffect,
    setMetrics,
    metricsRef,
    nodesRef,
    selectedNodeIdRef,
  });

  const executeCommand = (cmdStr) => {
    const parts = safeLower(cmdStr).trim().split(' ').filter(Boolean);
    const cmd = parts[0] || '';
    const args = parts.slice(1);

    addLog(`> ${cmdStr}`, 'default');

    const handler = cmdHandlers[cmd];
    if (typeof handler === 'function') {
      handler(cmd, args);
      return;
    }

    addLog(`Command not recognized: ${cmd}. Type 'help'.`, 'error');
  };

  const handleScriptRun = (scriptId, targetId) => {
    if (scriptId === 'scan') executeCommand('scan');
    if (scriptId === 'optimize') {
      addLog('Optimizing route tables...', 'system');
      setMetrics((prev) => ({ ...prev, load: Math.max(5, prev.load - 10) }));
      setTimeout(() => addLog('Optimization complete. CPU Load reduced.', 'success'), 1000);
    }
    if (scriptId === 'ping') executeCommand(`ping ${targetId}`);
    if (scriptId === 'purge') executeCommand(`purge ${targetId}`);
    if (scriptId === 'firewall') {
      addLog('Firewall reinforcement protocol queued.', 'system');
      setTimeout(() => addLog('Firewall status: STABLE', 'success'), 800);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div
      className={`flex flex-col h-screen w-full ${THEME.bg} text-slate-300 font-sans overflow-hidden`}
    >
      <TopBar systemIntegrity={metrics.integrity} activeThreads={nodes.length * 4} />

      <div className="flex flex-1 overflow-hidden relative">
        <LeftSidebar
          className={`${mobileTab === 'resources' ? 'flex w-full' : 'hidden'} md:flex md:w-64`}
          selectedNode={selectedNode}
          onRunScript={handleScriptRun}
          addLog={addLog}
        />

        <div
          className={`relative flex-1 flex flex-col min-w-0 ${mobileTab === 'graph' ? 'block' : 'hidden'} md:block`}
        >
          <NodeGraph nodes={nodes} onNodeClick={handleNodeClick} activeEffect={activeEffect} />
          <Terminal
            logs={logs}
            onCommand={executeCommand}
            isOpen={terminalOpen}
            toggleOpen={() => setTerminalOpen(!terminalOpen)}
          />
        </div>

        <PerformancePanel
          className={`${mobileTab === 'monitor' ? 'flex w-full' : 'hidden'} md:flex md:w-80`}
          metrics={metrics}
        />
      </div>

      <MobileNav activeTab={mobileTab} setActiveTab={setMobileTab} />
    </div>
  );
};

export default Dashboard;
