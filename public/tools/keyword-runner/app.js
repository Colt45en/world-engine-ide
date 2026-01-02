const PROCESS_URL = './process.json';

// ---------------------------
// IndexedDB Decoding Store
// ---------------------------
function openDecodingDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('decoding_store', 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('runs')) {
                const store = db.createObjectStore('runs', { keyPath: 'id' });
                store.createIndex('by_time', 'createdAt');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbPutRun(run) {
    const db = await openDecodingDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('runs', 'readwrite');
        tx.objectStore('runs').put(run);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function dbGetLatestRun() {
    const db = await openDecodingDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('runs', 'readonly');
        const idx = tx.objectStore('runs').index('by_time');
        const req = idx.openCursor(null, 'prev');
        req.onsuccess = () => {
            const cursor = req.result;
            resolve(cursor ? cursor.value : null);
        };
        req.onerror = () => reject(req.error);
    });
}

async function dbClear() {
    const db = await openDecodingDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('runs', 'readwrite');
        tx.objectStore('runs').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ---------------------------
// Deterministic helpers
// ---------------------------
async function sha256Hex(str) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(buf));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function nowIso() {
    return new Date().toISOString();
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// ---------------------------
// Physics (LMN cavity resonance)
// f = (c/2)/sqrt(er*ur) * sqrt((l/a)^2+(m/b)^2+(n/d)^2)
// ---------------------------
const C = 299792458;

function cavityResonantHz(cavity, idx) {
    const { a, b, d, er, ur } = cavity;
    const { mode, l, m, n } = idx;

    if (!(a > 0 && b > 0 && d > 0 && er > 0 && ur > 0)) {
        throw new TypeError('cavity params must be > 0');
    }

    if (mode === 'TE') {
        if (![l, m, n].every(Number.isInteger) || l < 0 || m < 0 || n < 0) {
            throw new TypeError('TE indices must be non-negative ints');
        }
        if (l === 0 && m === 0 && n === 0) {
            throw new RangeError('TE(0,0,0) invalid');
        }
    } else if (mode === 'TM') {
        if (![l, m, n].every(Number.isInteger) || l < 1 || m < 1 || n < 1) {
            throw new TypeError('TM indices must be positive ints');
        }
    } else {
        throw new TypeError('mode must be TE or TM');
    }

    const inv = 1 / Math.sqrt(er * ur);
    const k = Math.hypot(l / a, m / b, n / d);
    return (C / 2) * k * inv;
}

function vFromF(f, f0, R = 12) {
    if (f <= 0 || f0 <= 0) {
        throw new TypeError('positive frequencies required');
    }
    return (12 / R) * (Math.log(f / f0) / Math.log(2));
}

// ---------------------------
// Load + validate process.json
// ---------------------------
async function loadProcess() {
    const res = await fetch(PROCESS_URL, { cache: 'no-cache' });
    if (!res.ok) {
        throw new Error(`Failed to load ${PROCESS_URL}: ${res.status}`);
    }
    const cfg = await res.json();

    if (!cfg || typeof cfg !== 'object') {
        throw new TypeError('process.json must be an object');
    }
    if (typeof cfg.mappingVersion !== 'string' || !cfg.mappingVersion) {
        throw new TypeError('mappingVersion required');
    }
    if (!cfg.keywords || typeof cfg.keywords !== 'object') {
        throw new TypeError('keywords required');
    }

    return cfg;
}

// ---------------------------
// Keyword extraction
// ---------------------------
function findKeywordHits(source, keywordMap) {
    const hits = [];

    for (const [kw, spec] of Object.entries(keywordMap)) {
        if (!kw.endsWith(':')) {
            continue;
        }

        for (let idx = 0; ; ) {
            const at = source.indexOf(kw, idx);
            if (at === -1) break;
            hits.push({ keyword: kw, at, spec, kind: 'prefix' });
            idx = at + kw.length;
        }
    }

    const tokens = source.match(/\w+/g) ?? [];
    const tokenSet = new Set(tokens);

    for (const [kw, spec] of Object.entries(keywordMap)) {
        if (kw.endsWith(':')) {
            continue;
        }
        if (tokenSet.has(kw)) {
            hits.push({ keyword: kw, at: source.indexOf(kw), spec, kind: 'token' });
        }
    }

    hits.sort((a, b) => (a.at - b.at) || a.keyword.localeCompare(b.keyword));
    return hits;
}

// ---------------------------
// Action registry (NO eval)
// ---------------------------
const ACTIONS = {
    cavityMode: (ctx, params) => {
        const cavity = ctx.defaults?.cavity;
        if (!cavity) {
            throw new Error('Missing defaults.cavity');
        }

        const fHz = cavityResonantHz(cavity, params);
        const vRaw = vFromF(fHz, ctx.f0, ctx.R);
        const v = clamp(vRaw, -1, 1);

        return {
            type: 'cavity_mode',
            label: `${params.mode}${params.l}${params.m}${params.n}`,
            f_hz: fHz,
            v_raw: vRaw,
            v,
            cavity,
        };
    },

    tagNumber: (_ctx, params) => {
        const n = Number(params.value);
        return { type: 'number_tag', value: n };
    },

    markUnfold: () => {
        return { type: 'unfold_marker_seen', note: 'Detected &token: prefix in source' };
    },
};

function runHits(cfg, source, hits) {
    const ctx = {
        defaults: cfg.defaults || {},
        f0: 528,
        R: 12,
    };

    const results = [];

    for (const h of hits) {
        const actionName = h.spec.action;
        const fn = ACTIONS[actionName];

        if (!fn) {
            results.push({ keyword: h.keyword, error: `Unknown action: ${actionName}` });
            continue;
        }

        try {
            const out = fn(ctx, h.spec.params || {});
            results.push({ keyword: h.keyword, action: actionName, output: out });
        } catch (e) {
            results.push({ keyword: h.keyword, action: actionName, error: String(e?.message || e) });
        }
    }

    return results;
}

// ---------------------------
// Orchestrator: load → extract → run → store
// ---------------------------
async function runAndSave(source) {
    const cfg = await loadProcess();
    const hits = findKeywordHits(source, cfg.keywords);
    const decoded = runHits(cfg, source, hits);

    const sourceHash = await sha256Hex(source);
    const configHash = await sha256Hex(JSON.stringify(cfg));

    const run = {
        id: `${cfg.mappingVersion}:${sourceHash}`,
        createdAt: nowIso(),
        mappingVersion: cfg.mappingVersion,
        sourceHash,
        configHash,
        source,
        hits: hits.map((h) => ({ keyword: h.keyword, kind: h.kind, at: h.at, action: h.spec.action })),
        decoded,
    };

    await dbPutRun(run);
    return run;
}

// ---------------------------
// UI wiring
// ---------------------------
const outEl = document.getElementById('out');
const srcEl = document.getElementById('src');
const runBtn = document.getElementById('runBtn');
const loadBtn = document.getElementById('loadBtn');
const clearBtn = document.getElementById('clearBtn');

function show(obj) {
    outEl.textContent = JSON.stringify(obj, null, 2);
}

runBtn.addEventListener('click', async () => {
    try {
        const run = await runAndSave(srcEl.value);
        show(run);
    } catch (e) {
        show({ error: String(e?.message || e) });
    }
});

loadBtn.addEventListener('click', async () => {
    try {
        const latest = await dbGetLatestRun();
        show(latest ?? { note: 'No saved runs yet' });
    } catch (e) {
        show({ error: String(e?.message || e) });
    }
});

clearBtn.addEventListener('click', async () => {
    try {
        await dbClear();
        show({ ok: true, cleared: true });
    } catch (e) {
        show({ error: String(e?.message || e) });
    }
});

async function init() {
    try {
        const run = await runAndSave(srcEl.value);
        show(run);
    } catch (e) {
        show({ error: String(e?.message || e) });
    }
}

void init();
